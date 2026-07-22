const { getDb, createLogger } = require("@dk/shared");

const log = createLogger("cms-owner-intake");

// CMS owner intake over DM.
//
// A merchant generates a one-time invite link in the web CMS
// (t.me/<bot>?start=<token>). The owner opens it, the bot binds the chat to
// the `owners` row, then walks through the built-in fields plus the
// country's `country_fields` config (so a new field added in the CMS shows
// up here automatically). All progress is derived from the DB, so the flow
// survives bot restarts. Files are re-uploaded to Supabase Storage
// (owner-docs bucket) instead of relying on Telegram file_ids.

const DOCS_BUCKET = "owner-docs";

const BUILTIN_STEPS = [
  { key: "full_name", kind: "text", col: "full_name", prompt: "Please enter the owner's full name:" },
  { key: "id_number", kind: "text", col: "id_number", prompt: "Please enter the ID number:" },
  { key: "id_front", kind: "file", col: "id_front_path", prompt: "Please upload a photo of the ID card (FRONT side):" },
  { key: "id_back", kind: "file", col: "id_back_path", prompt: "Please upload a photo of the ID card (BACK side):" },
];

async function loadCountryFields(db, countryId) {
  const { data, error } = await db
    .from("country_fields")
    .select("*")
    .eq("country_id", countryId)
    .eq("active", true)
    .order("sort");
  if (error) throw error;
  return data || [];
}

// Returns { builtin } | { field } | null (= everything collected).
async function nextStep(db, owner) {
  for (const step of BUILTIN_STEPS) {
    if (!owner[step.col]) return { builtin: step };
  }
  const fields = await loadCountryFields(db, owner.country_id);
  if (fields.length === 0) return null;
  const { data: values, error } = await db
    .from("owner_field_values")
    .select("field_id, value_text, file_path")
    .eq("owner_id", owner.id);
  if (error) throw error;
  const byField = new Map((values || []).map((v) => [v.field_id, v]));
  for (const f of fields) {
    const v = byField.get(f.id);
    const has = f.field_type === "file" ? Boolean(v && v.file_path) : Boolean(v && v.value_text);
    if (!has) return { field: f };
  }
  return null;
}

function promptFor(step) {
  if (step.builtin) return { text: step.builtin.prompt };
  const f = step.field;
  switch (f.field_type) {
    case "file":
      return { text: `Please upload: ${f.label}` };
    case "date":
      return { text: `Please enter ${f.label} (format: YYYY-MM-DD):` };
    case "number":
      return { text: `Please enter ${f.label} (numbers only):` };
    case "select":
      return {
        text: `Please choose ${f.label}:`,
        keyboard: {
          inline_keyboard: (f.options || []).map((opt, i) => [
            { text: opt, callback_data: `cmsopt:${f.id}:${i}` },
          ]),
        },
      };
    default:
      return { text: `Please enter ${f.label}:` };
  }
}

async function sendPrompt(ctx, step) {
  const p = promptFor(step);
  await ctx.reply(p.text, p.keyboard ? { reply_markup: p.keyboard } : undefined);
}

// The owner currently being collected for this Telegram user (draft only).
async function getActiveOwner(db, telegramUserId) {
  const { data, error } = await db
    .from("owners")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .eq("status", "draft")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function finalize(ctx, db, owner) {
  await db
    .from("owners")
    .update({ status: "pending", reject_reason: null, updated_at: new Date().toISOString() })
    .eq("id", owner.id);
  await ctx.reply("✅ All information received. Your submission is now waiting for review — we'll notify you here once it has been checked.");
}

async function advance(ctx, db, owner) {
  const step = await nextStep(db, owner);
  if (!step) return finalize(ctx, db, owner);
  await sendPrompt(ctx, step);
}

async function saveText(db, owner, step, value) {
  if (step.builtin) {
    await db
      .from("owners")
      .update({ [step.builtin.col]: value, updated_at: new Date().toISOString() })
      .eq("id", owner.id);
    return;
  }
  await db.from("owner_field_values").upsert(
    {
      owner_id: owner.id,
      field_id: step.field.id,
      value_text: value,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "owner_id,field_id" }
  );
}

async function downloadToStorage(ctx, db, owner, key, fileId, mimeHint) {
  const link = await ctx.telegram.getFileLink(fileId);
  const res = await fetch(link.href);
  if (!res.ok) throw new Error(`telegram file download failed: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || mimeHint || "application/octet-stream";
  const ext = contentType.includes("pdf") ? "pdf" : contentType.includes("png") ? "png" : "jpg";
  const path = `owners/${owner.id}/${key}.${ext}`;
  const { error } = await db.storage
    .from(DOCS_BUCKET)
    .upload(path, buf, { contentType, upsert: true });
  if (error) throw new Error(`storage upload failed: ${error.message}`);
  return path;
}

function registerCmsOwnerIntake(bot) {
  // /start <invite_token> in DM: bind this chat to the owner record.
  bot.start(async (ctx, next) => {
    if (ctx.chat.type !== "private") return next && next();
    const token = (ctx.startPayload || "").trim();
    const db = getDb();

    if (!token) {
      const active = await getActiveOwner(db, ctx.from.id);
      if (!active) return next && next();
      await ctx.reply("Welcome back! Let's continue where we left off.");
      return advance(ctx, db, active);
    }

    const { data: owner } = await db
      .from("owners")
      .select("*")
      .eq("invite_token", token)
      .maybeSingle();
    if (!owner) {
      return ctx.reply("This invite link is invalid or has already been used. Please ask for a new link.");
    }
    if (owner.invite_expires_at && new Date(owner.invite_expires_at) < new Date()) {
      return ctx.reply("This invite link has expired. Please ask for a new link.");
    }
    if (owner.status !== "draft") {
      return ctx.reply("This submission is already being processed — nothing more to do here.");
    }

    await db
      .from("owners")
      .update({
        telegram_user_id: ctx.from.id,
        invite_token: null,
        invite_expires_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", owner.id);
    owner.telegram_user_id = ctx.from.id;

    log.info(`owner ${owner.id} bound to telegram user ${ctx.from.id}`);
    await ctx.reply("👋 Welcome! I'll collect a few details and documents. You can stop and continue anytime — your progress is saved.");
    return advance(ctx, db, owner);
  });

  // Select-field answer via inline button.
  bot.action(/^cmsopt:([0-9a-f-]+):(\d+)$/, async (ctx) => {
    await ctx.answerCbQuery();
    const [, fieldId, idxRaw] = ctx.match;
    const db = getDb();
    const owner = await getActiveOwner(db, ctx.from.id);
    if (!owner) return;

    const { data: field } = await db.from("country_fields").select("*").eq("id", fieldId).maybeSingle();
    const opt = field && (field.options || [])[parseInt(idxRaw, 10)];
    if (!opt) return;

    await db.from("owner_field_values").upsert(
      { owner_id: owner.id, field_id: fieldId, value_text: opt, updated_at: new Date().toISOString() },
      { onConflict: "owner_id,field_id" }
    );
    await ctx.reply(`${field.label}: ${opt} ✔️`);
    return advance(ctx, db, owner);
  });

  // Free-text answers in DM.
  bot.on("text", async (ctx, next) => {
    if (ctx.chat.type !== "private") return next && next();
    if (ctx.message.text.startsWith("/")) return next && next();
    const db = getDb();
    const owner = await getActiveOwner(db, ctx.from.id);
    if (!owner) return next && next();

    const step = await nextStep(db, owner);
    if (!step) return finalize(ctx, db, owner);

    const isFile = step.builtin ? step.builtin.kind === "file" : step.field.field_type === "file";
    if (isFile) {
      return sendPrompt(ctx, step); // remind: we expect an upload here
    }

    const value = ctx.message.text.trim();
    if (step.field) {
      const f = step.field;
      if (f.field_type === "number" && !/^-?\d+([.,]\d+)?$/.test(value)) {
        return ctx.reply(`${f.label} should be a number. Please try again:`);
      }
      if (f.field_type === "date" && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return ctx.reply(`${f.label} should be a date in YYYY-MM-DD format (e.g. 1990-05-21). Please try again:`);
      }
      if (f.field_type === "select") {
        const match = (f.options || []).find((o) => o.toLowerCase() === value.toLowerCase());
        if (!match) return sendPrompt(ctx, step);
        await saveText(db, owner, step, match);
        return advance(ctx, db, owner);
      }
    }

    await saveText(db, owner, step, value);
    return advance(ctx, db, owner);
  });

  // Photo / document uploads in DM.
  bot.on(["photo", "document"], async (ctx, next) => {
    if (ctx.chat.type !== "private") return next && next();
    const db = getDb();
    const owner = await getActiveOwner(db, ctx.from.id);
    if (!owner) return next && next();

    const step = await nextStep(db, owner);
    if (!step) return finalize(ctx, db, owner);

    const isFile = step.builtin ? step.builtin.kind === "file" : step.field.field_type === "file";
    if (!isFile) return sendPrompt(ctx, step); // we expect text at this point

    const fileId = ctx.message.photo
      ? ctx.message.photo[ctx.message.photo.length - 1].file_id
      : ctx.message.document.file_id;
    const mimeHint = ctx.message.document ? ctx.message.document.mime_type : "image/jpeg";

    try {
      if (step.builtin) {
        const path = await downloadToStorage(ctx, db, owner, step.builtin.key, fileId, mimeHint);
        await db
          .from("owners")
          .update({ [step.builtin.col]: path, updated_at: new Date().toISOString() })
          .eq("id", owner.id);
      } else {
        const path = await downloadToStorage(ctx, db, owner, `f_${step.field.field_key}`, fileId, mimeHint);
        await db.from("owner_field_values").upsert(
          { owner_id: owner.id, field_id: step.field.id, file_path: path, updated_at: new Date().toISOString() },
          { onConflict: "owner_id,field_id" }
        );
      }
    } catch (err) {
      log.error(`file save failed for owner ${owner.id}:`, err);
      return ctx.reply("Sorry, saving that file failed. Please send it again.");
    }

    await ctx.reply("Received ✔️");
    return advance(ctx, db, owner);
  });
}

module.exports = { registerCmsOwnerIntake };
