import "server-only";

function required(name: string): string {
  const v = process.env[name];
  if (!v || v.trim() === "") {
    throw new Error(`Missing environment variable: ${name}. Set it in .env.local.`);
  }
  return v;
}

export const env = {
  supabaseUrl: () => required("SUPABASE_URL"),
  supabaseServiceKey: () => required("SUPABASE_KEY"),
  sessionSecret: () => required("SESSION_SECRET"),
  onboardingBotToken: () => required("BOT_TOKEN_ONBOARDING"),
  // Username (without @) of the onboarding bot, used to build invite links.
  onboardingBotUsername: () => process.env.ONBOARDING_BOT_USERNAME || "Dkonboarding_bot",
};
