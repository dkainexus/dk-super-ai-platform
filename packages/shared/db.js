const { createClient } = require("@supabase/supabase-js");

let client = null;

function getDb() {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL / SUPABASE_KEY must be set");
  }
  client = createClient(url, key, { auth: { persistSession: false } });
  return client;
}

module.exports = { getDb };
