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
// CMS superadmin side: who can manage countries / merchants / fields
export const ADMIN_ROLES: Role[] = ["ceo", "coo", "admin"];

// ---------- CMS ----------

export type Country = {
  id: string;
  code: string;
  name: string;
  flag: string | null;
  active: boolean;
  sort: number;
  created_at: string;
};

export type MerchantStatus = "active" | "suspended";

export type Merchant = {
  id: string;
  country_id: string;
  name: string;
  logo_path: string | null;
  subdomain: string | null;
  custom_domain: string | null;
  status: MerchantStatus;
  created_at: string;
};

export type MerchantUser = {
  id: string;
  merchant_id: string;
  username: string;
  password_hash: string;
  name: string | null;
  must_change_password: boolean;
  active: boolean;
  created_at: string;
};

export type FieldType = "text" | "number" | "date" | "file" | "select";

export type CountryField = {
  id: string;
  country_id: string;
  field_key: string;
  label: string;
  field_type: FieldType;
  options: string[];
  required: boolean;
  sort: number;
  active: boolean;
  created_at: string;
};

export type OwnerStatus = "draft" | "pending" | "approved" | "rejected";

export type Owner = {
  id: string;
  merchant_id: string;
  country_id: string;
  full_name: string | null;
  id_number: string | null;
  id_front_path: string | null;
  id_back_path: string | null;
  status: OwnerStatus;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  telegram_user_id: number | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

export type OwnerFieldValue = {
  id: string;
  owner_id: string;
  field_id: string;
  value_text: string | null;
  file_path: string | null;
  updated_at: string;
};

export const OWNER_STATUS_LABEL: Record<OwnerStatus, string> = {
  draft: "资料收集中",
  pending: "待审核",
  approved: "已通过",
  rejected: "已拒绝",
};
