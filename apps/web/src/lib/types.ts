import type { Action, Scope } from "./rbac";

// ---------- Unified users & roles (foundation) ----------

export type User = {
  id: string;
  username: string;
  email: string | null;
  password_hash: string;
  name: string | null;
  avatar_path: string | null;
  merchant_id: string | null; // null = platform side
  role_id: string | null;
  is_superadmin: boolean;
  must_change_password: boolean;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type RoleLevel = "platform" | "merchant";

export type Role = {
  id: string;
  level: RoleLevel;
  merchant_id: string | null; // set = created by that merchant
  name: string;
  description: string | null;
  is_system: boolean;
  created_at: string;
};

export type RolePermission = {
  id: string;
  role_id: string;
  module: string;
  action: Action;
  scope: Scope;
};

// Legacy staff table — still used by the Telegram bot review pages.
export type Staff = {
  id: string;
  telegram_user_id: number;
  name: string | null;
  role: string;
  active: boolean;
  username: string | null;
  password_hash: string | null;
  must_change_password: boolean;
  created_at: string;
};

// ---------- CMS ----------

export type Country = {
  id: string;
  code: string;
  name: string;
  flag: string | null;
  timezone: string; // IANA, e.g. Asia/Bangkok
  currency: string; // ISO 4217, e.g. THB
  disabled_modules: string[];
  active: boolean;
  sort: number;
  created_at: string;
};

export type MerchantStatus = "active" | "suspended";

export type Merchant = {
  id: string;
  name: string;
  logo_path: string | null;
  subdomain: string | null;
  custom_domain: string | null;
  status: MerchantStatus;
  disabled_modules: string[];
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

export type OwnerStatus = "draft" | "pending" | "approved" | "rejected" | "banned";

export type Owner = {
  id: string;
  merchant_id: string;
  country_id: string;
  full_name: string | null;
  id_number: string | null;
  gender: "male" | "female" | "other" | null;
  marital_status: "single" | "married" | "divorced" | "widowed" | null;
  phone: string | null;
  email: string | null;
  id_front_path: string | null;
  id_back_path: string | null;
  photo_full_body_path: string | null;
  bank_id: string | null;
  bank_account_no: string | null;
  occupation_id: string | null;
  status: OwnerStatus;
  reject_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  telegram_user_id: number | null;
  invite_token: string | null;
  invite_expires_at: string | null;
  notes: string | null;
  created_by: string | null;
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
  draft: "Collecting",
  pending: "Pending Review",
  approved: "Approved",
  rejected: "Rejected",
  banned: "Banned",
};

export type Bank = {
  id: string;
  country_id: string;
  name: string;
  code: string | null;
  active: boolean;
  sort: number;
  created_at: string;
};

export type Occupation = {
  id: string;
  name: string;
  company_type: string | null;
  active: boolean;
  sort: number;
  created_at: string;
};

export type TelegramBot = {
  id: string;
  name: string;
  token: string;
  bot_username: string | null;
  note: string | null;
  active: boolean;
  last_check_ok: boolean | null;
  last_check_at: string | null;
  created_at: string;
};

// ---------- Companies module ----------

export type CompanyStatus = "preparing" | "registered" | "closed" | "banned";

export type Company = {
  id: string;
  merchant_id: string;
  country_id: string;
  name: string;
  company_id: string | null; // official registration number
  company_type: string | null;
  business_start_date: string | null;
  address_no: string | null;
  street: string | null;
  subdistrict: string | null;
  district: string | null;
  province: string | null;
  postal_code: string | null;
  status: CompanyStatus;
  notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type CompanyMember = {
  id: string;
  company_id: string;
  owner_id: string;
  role: "owner" | "shareholder";
  share_percent: number | null;
  created_at: string;
};

export const COMPANY_STATUS_LABEL: Record<CompanyStatus, string> = {
  preparing: "Preparing",
  registered: "Registered",
  closed: "Closed",
  banned: "Banned",
};
