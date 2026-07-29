#!/usr/bin/env node
// Branded APK build agent.
//
// The CMS runs on Vercel and cannot compile Android, so it only queues rows in
// `app_builds`. This agent runs on the build server, polls for queued jobs and
// for each one: rebrands the Expo project (app name, package id, icon), builds
// a release APK, uploads it to the app-releases bucket and marks the row ready.
//
// Run it under pm2:  pm2 start tools/app-build-agent/agent.mjs --name dk-app-builder

import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { readFile, writeFile, copyFile, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const run = promisify(execFile);

const MOBILE_DIR = process.env.MOBILE_DIR ?? "/root/dk-super-ai-platform/mobile";
const ANDROID_HOME = process.env.ANDROID_HOME ?? "/opt/android-sdk";
const POLL_MS = Number(process.env.POLL_MS ?? 60_000);
const BUCKET = "app-releases";

function env(file) {
  const text = readFileSync(file);
  return Object.fromEntries(
    text
      .split("\n")
      .filter((l) => l.includes("="))
      .map((l) => [l.slice(0, l.indexOf("=")).trim(), l.slice(l.indexOf("=") + 1).trim()])
  );
}
function readFileSync(p) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return require("node:fs").readFileSync(p, "utf8");
}

const cfg = env(process.env.ENV_FILE ?? "/root/dk-super-ai-platform/apps/web/.env.local");
const supabase = createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY);

const log = (...a) => console.log(new Date().toISOString(), ...a);

/** Swap in the brand's name, package id and icon, build, then restore. */
async function build(job, merchant) {
  const appJsonPath = path.join(MOBILE_DIR, "app.json");
  const gradlePath = path.join(MOBILE_DIR, "android/app/build.gradle");
  const stringsPath = path.join(MOBILE_DIR, "android/app/src/main/res/values/strings.xml");
  const originals = await Promise.all([readFile(appJsonPath, "utf8"), readFile(gradlePath, "utf8"), readFile(stringsPath, "utf8")]);

  const workIcons = [];
  try {
    const appJson = JSON.parse(originals[0]);
    appJson.expo.name = merchant.app_name;
    appJson.expo.android = { ...(appJson.expo.android ?? {}), package: merchant.app_package_id, versionCode: job.version_code };
    appJson.expo.version = job.version_name;
    await writeFile(appJsonPath, JSON.stringify(appJson, null, 2));

    let gradle = originals[1]
      .replace(/applicationId\s+['"][^'"]+['"]/, `applicationId '${merchant.app_package_id}'`)
      .replace(/versionCode\s+\d+/, `versionCode ${job.version_code}`)
      .replace(/versionName\s+"[^"]+"/, `versionName "${job.version_name}"`);
    await writeFile(gradlePath, gradle);

    await writeFile(
      stringsPath,
      originals[2].replace(/<string name="app_name">[^<]*<\/string>/, `<string name="app_name">${merchant.app_name}</string>`)
    );

    // Brand icon: replace every mipmap launcher asset with the uploaded image.
    if (merchant.app_icon_path) {
      const { data, error } = await supabase.storage.from("cms-assets").download(merchant.app_icon_path);
      if (!error && data) {
        const buf = Buffer.from(await data.arrayBuffer());
        const resDir = path.join(MOBILE_DIR, "android/app/src/main/res");
        for (const density of ["mdpi", "hdpi", "xhdpi", "xxhdpi", "xxxhdpi"]) {
          for (const name of ["ic_launcher.webp", "ic_launcher_round.webp", "ic_launcher_foreground.webp"]) {
            const target = path.join(resDir, `mipmap-${density}`, name);
            if (existsSync(target)) {
              const backup = `${target}.orig`;
              if (!existsSync(backup)) await copyFile(target, backup);
              await writeFile(target, buf);
              workIcons.push({ target, backup });
            }
          }
        }
      }
    }

    log(`building ${merchant.app_name} v${job.version_name} (${merchant.app_package_id})`);
    const { stdout, stderr } = await run(
      "./gradlew",
      ["assembleRelease", "-PreactNativeArchitectures=arm64-v8a", "--console=plain", "-q"],
      { cwd: path.join(MOBILE_DIR, "android"), env: { ...process.env, ANDROID_HOME }, maxBuffer: 32 * 1024 * 1024, timeout: 45 * 60_000 }
    );

    const apk = path.join(MOBILE_DIR, "android/app/build/outputs/apk/release/app-release.apk");
    const bytes = await readFile(apk);
    const key = `brands/${merchant.id}-${job.version_code}.apk`;
    const { error: upErr } = await supabase.storage.from(BUCKET).upload(key, bytes, {
      contentType: "application/vnd.android.package-archive",
      upsert: true,
    });
    if (upErr) throw new Error(`upload failed: ${upErr.message}`);

    return { apkPath: key, log: (stdout + stderr).slice(-4000) };
  } finally {
    await writeFile(appJsonPath, originals[0]);
    await writeFile(gradlePath, originals[1]);
    await writeFile(stringsPath, originals[2]);
    for (const { target, backup } of workIcons) await copyFile(backup, target);
  }
}

async function tick() {
  const { data: jobs } = await supabase
    .from("app_builds")
    .select("*, merchant:merchants(id, app_name, app_icon_path, app_package_id)")
    .eq("status", "queued")
    .order("created_at")
    .limit(1);
  const job = jobs?.[0];
  if (!job) return;

  await supabase.from("app_builds").update({ status: "building", updated_at: new Date().toISOString() }).eq("id", job.id);
  try {
    const { apkPath, log: buildLog } = await build(job, job.merchant);
    await supabase
      .from("app_builds")
      .update({ status: "ready", apk_path: apkPath, log: buildLog, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    log(`ready: ${apkPath}`);
  } catch (e) {
    const message = e instanceof Error ? `${e.message}\n${e.stderr ?? ""}`.slice(-4000) : String(e);
    await supabase
      .from("app_builds")
      .update({ status: "failed", log: message, updated_at: new Date().toISOString() })
      .eq("id", job.id);
    log("failed:", message.split("\n")[0]);
  }
}

log(`app build agent watching ${MOBILE_DIR} every ${POLL_MS / 1000}s`);
await tick();
setInterval(() => {
  tick().catch((e) => log("tick error:", e.message));
}, POLL_MS);
