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
};
