export type Role = "ceo" | "coo" | "director" | "admin" | "agent";

export type Staff = {
  id: string;
  telegram_user_id: number;
  name: string | null;
  role: Role;
  active: boolean;
  username: string | null;
  password_hash: string | null;
  must_change_password: boolean;
  created_at: string;
};

export const REVIEWER_ROLES: Role[] = ["ceo", "coo", "admin"];
