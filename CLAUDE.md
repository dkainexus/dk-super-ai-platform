# DK AP System — conventions

- **Numbers/money shown to users MUST have thousands separators** (10,000 not 10000). Web: use `fmtNum`/`fmtMoney` from `apps/web/src/lib/format.ts` for display and the `MoneyInput` component (`apps/web/src/components/money-input.tsx`) for amount inputs — never a bare `type="number"` input for money. Mobile: use `.toLocaleString()` for display and the money-formatting input patterns in `mobile/src`.
- Business modules live in self-contained folders `apps/web/src/modules/<key>/` (index.ts ModuleDef + actions.ts + lib.ts + components/ + install.sql); route files stay thin.
- Every module registers 4 permissions (view/add/edit/delete) and is togglable globally, per country, and per white label.
- UI text is English only. Action buttons use `ActionButton`/`SaveButton` with tooltips.
- Mobile app (mobile/) is Expo SDK 57, app name "Work Hub". All user-facing strings go through `useI18n().t()` (en/th/vi/zh dictionaries in `mobile/src/lib/i18n.tsx`).
- Migrations: apply via Supabase MCP AND save the same SQL under `supabase/migrations/NNNN_*.sql`. Beware legacy bot tables shadowing new names (`create table if not exists` silently skips).
- **Every new table gets `alter table <t> enable row level security;` in its migration, with no policies.** The web app, the bots and the mobile API routes all use the service role key, which bypasses RLS; nothing queries Postgres from the browser or from Expo, so no policy is ever needed. Without RLS the data API is wide open to the project's anon key — see `supabase/migrations/0029_lock_down_data_api.sql`, which also revokes the `anon`/`authenticated` grants as a backstop. Verify with `select` on `users` using the anon key: it must return `42501`.
- Release APK: arm64-only + R8 minify (fixed in gradle.properties) to stay under the 50MB storage upload limit; bump versionCode/versionName in BOTH `mobile/app.json` and `mobile/android/app/build.gradle`.
