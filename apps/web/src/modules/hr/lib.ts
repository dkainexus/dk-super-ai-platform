import { db } from "@/lib/supabase";

export type EmployeeStatus = "probation" | "active" | "resigned" | "terminated";

export type Employee = {
  id: string;
  ref: string | null;
  country_id: string;
  name: string;
  national_id: string | null;
  phone: string | null;
  email: string | null;
  department_id: string | null;
  position: string | null;
  hired_on: string;
  base_salary: number;
  currency: string | null;
  bank_name: string | null;
  bank_account_no: string | null;
  user_id: string | null;
  status: EmployeeStatus;
  left_on: string | null;
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string | null;
  updated_by: string | null;
};

export type EmployeeRow = Employee & {
  department: { name: string } | null;
  login: { username: string; active: boolean } | null;
};

export const EMPLOYEE_SELECT = "*, department:departments(name), login:users!employees_user_id_fkey(username, active)";

/** Someone still on the books — probation counts, the departed don't. */
export const isOnPayroll = (s: EmployeeStatus): boolean => s === "probation" || s === "active";

export async function departmentsFor(countryId: string, activeOnly = true) {
  let q = db().from("departments").select("id, name, active").eq("country_id", countryId).order("name");
  if (activeOnly) q = q.eq("active", true);
  const { data } = await q;
  return (data ?? []) as { id: string; name: string; active: boolean }[];
}

export async function employee(id: string): Promise<EmployeeRow | null> {
  const { data } = await db().from("employees").select(EMPLOYEE_SELECT).eq("id", id).maybeSingle();
  return (data as unknown as EmployeeRow) ?? null;
}

export const payrollNet = (i: { base_salary: number; bonus: number; deduction: number }): number =>
  Number(i.base_salary) + Number(i.bonus) - Number(i.deduction);
