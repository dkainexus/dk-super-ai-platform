# Branded APK build agent

The CMS runs on Vercel and cannot compile Android, so "Build APK" on a white
label only queues a row in `app_builds`. This agent runs on the build server,
picks the job up and does the work.

```bash
cd /root/dk-super-ai-platform
pm2 start tools/app-build-agent/agent.mjs --name dk-app-builder
pm2 save
```

Per job it: rewrites the app name, package id and version in `mobile/`,
swaps the launcher icons for the uploaded one, runs
`./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a`, uploads the
APK to `app-releases/brands/<merchant>-<versionCode>.apk`, and marks the row
`ready` (or `failed` with the tail of the log). The project files are always
restored afterwards, so the shared Work Hub build is untouched.

Env: `MOBILE_DIR`, `ANDROID_HOME`, `POLL_MS`, `ENV_FILE` (defaults suit this server).
