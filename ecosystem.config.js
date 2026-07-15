// pm2 process list. bot-training / bot-banking are added here once they're
// built in Phase 2 (see the plan) — for now only the Phase 1 slice runs.
module.exports = {
  apps: [
    {
      name: "dk-group-ops",
      cwd: "./apps/bot-group-ops",
      script: "src/index.js",
    },
    {
      name: "dk-onboarding",
      cwd: "./apps/bot-onboarding",
      script: "src/index.js",
    },
    {
      name: "dk-super-ai",
      cwd: "./apps/bot-super-ai",
      script: "src/index.js",
    },
    {
      name: "dk-web",
      cwd: "./apps/web",
      script: "npm",
      args: "start",
    },
  ],
};
