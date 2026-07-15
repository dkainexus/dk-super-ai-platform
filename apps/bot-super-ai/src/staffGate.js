const { getDb } = require("@dk/shared");

const ACTION_ROLES = ["ceo", "coo"];

async function findActiveStaff(telegramUserId) {
  const db = getDb();
  const { data, error } = await db
    .from("staff")
    .select("*")
    .eq("telegram_user_id", telegramUserId)
    .eq("active", true)
    .maybeSingle();
  if (error) throw error;
  return data;
}

function canActOnBehalfOfBots(staff) {
  return !!staff && ACTION_ROLES.includes(staff.role);
}

module.exports = { findActiveStaff, canActOnBehalfOfBots };
