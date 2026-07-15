# DK Super AI Platform

Ground-up rebuild of the DK Super AI Telegram business (recruitment →
company registration → training/exam → bank account opening), replacing
the old single-bot `dk-training` with multiple purpose-built bots plus a
web dashboard, all sharing one Supabase project.

Full architecture and phased build plan: see the approved plan this repo
was scaffolded from (bot boundaries, job-queue design, data model, phases).

## Apps (current — Phase 1 slice)

- `apps/bot-group-ops` — group-structural Telegram admin actions (create/rename
  topics, set avatar, auto-promote/security-leave guard). Executes jobs from
  `bot_jobs` targeted at `group_ops`.
- `apps/bot-onboarding` — Phase 1 of the business workflow: `/agent` / `/owner`
  binding, Documentation topic + 4-document upload flow, Notification topic
  messages, consumes `onboarding.notify_review_result` jobs from the web app.
- `apps/bot-super-ai` — DM-only orchestrator bot. Claude tool-calling loop;
  currently ships one tool (`change_group_avatar`) that dispatches a job to
  `bot-group-ops` and reports back the result.
- `apps/web` — Next.js dashboard: staff login, document review queue (approves
  a candidate's submitted documents and enqueues the notify job), bot/job
  monitor.

Not yet built (Phase 2 per the plan): `bot-training`, `bot-banking`, and the
web app's company/training/appointment/bank management pages.

## Shared package

`packages/shared` (`@dk/shared`) — Supabase client factory, the `bot_jobs`
queue client (`createJob`/`claimNext`/`completeJob`/`startWorker`/`waitForJob`/
`waitForBatch`), Telegram helper wrappers, i18n message bundles, logger.

## Running locally

```bash
npm install
cp .env.example .env   # fill in SUPABASE_URL/KEY, bot tokens, ANTHROPIC_API_KEY, SESSION_SECRET
```

Apply `supabase/migrations/0001_init.sql` then `supabase/seed.sql` to a fresh
Supabase project (via the Supabase MCP/CLI). The seed creates bootstrap
`bot_registry` rows and a web login `admin` / `123456` (forced password
change on first login).

Each bot reads its own `BOT_TOKEN_*` var; run them individually during
development:

```bash
npm run dev:group-ops
npm run dev:onboarding
npm run dev:super-ai
npm run dev:web
```

Or run everything under pm2 with `ecosystem.config.js` once tokens are set.

## End-to-end check for the Phase 1 slice

1. Add `bot-group-ops` and `bot-onboarding` to a test supergroup with Topics
   enabled; grant both admin.
2. In the General topic: reply to the "general agent"'s message with `/agent`,
   then reply to an applicant's message with `/owner` — Documentation topic
   should appear with a "Submit Document" button.
3. Click the button and upload the 4 documents in order — a Notification
   topic should appear with the submitted/pending messages.
4. In the web dashboard, approve or reject the candidate under 证件审核 —
   the Notification topic should receive the approved/rejected message.
5. DM `bot-super-ai` (as a seeded `ceo`/`coo` staff member) a photo, then
   "把 <group> 的头像换成这个" — it should dispatch a job, `bot-group-ops`
   should pick it up and change the photo, and Super AI should reply with
   the result.
