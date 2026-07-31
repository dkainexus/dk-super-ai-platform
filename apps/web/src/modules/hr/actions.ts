"use server";

// HR actions: the employee record is the person; the login is a separate
// thing they may or may not have. Leaving (resigned or terminated) always
// switches the login off in the same stroke.

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/supabase";
import { requirePerm } from "@/lib/auth";
import { hashPassword } from "@/lib/password";
import { uploadFile, fileExt, DOCS_BUCKET } from "@/lib/storage";
import { isOnPayroll, type EmployeeStatus } from "./lib";

function fail(path: string, message: string): never {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}error=${encodeURIComponent(message)}`);
}

const num = (v: FormDataEntryValue | null) => parseFloat(String(v ?? "").replace(/,/g, "")) || 0;
const str = (v: FormDataEntryValue | null) => String(v ?? "").trim() || null;

// ---------- Departments ----------

export async function saveDepartment(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "edit");
  if (cu.merchant) redirect("/m");
  const back = "/admin/hr/departments";
  const id = String(formData.get("id") ?? "");
  const name = String(formData.get("name") ?? "").trim();
  if (!name) fail(back, "Name the department");

  const { error } = id
    ? await db().from("departments").update({ name }).eq("id", id)
    : await db().from("departments").insert({ country_id: String(formData.get("country_id") ?? ""), name });
  if (error) fail(back, error.message.includes("duplicate") ? "That department already exists" : `Failed: ${error.message}`);
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

export async function toggleDepartment(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "edit");
  if (cu.merchant) redirect("/m");
  await db()
    .from("departments")
    .update({ active: String(formData.get("active") ?? "") === "true" })
    .eq("id", String(formData.get("id") ?? ""));
  revalidatePath("/admin/hr/departments");
  redirect("/admin/hr/departments");
}

// ---------- Employees ----------

function employeeFields(formData: FormData) {
  return {
    name: String(formData.get("name") ?? "").trim(),
    national_id: str(formData.get("national_id")),
    phone: str(formData.get("phone")),
    email: str(formData.get("email")),
    department_id: str(formData.get("department_id")),
    position: str(formData.get("position")),
    hired_on: String(formData.get("hired_on") ?? "") || new Date().toISOString().slice(0, 10),
    base_salary: num(formData.get("base_salary")),
    bank_name: str(formData.get("bank_name")),
    bank_account_no: str(formData.get("bank_account_no")),
    notes: str(formData.get("notes")),
  };
}

export async function createEmployee(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "add");
  if (cu.merchant) redirect("/m");
  const back = "/admin/hr/new";
  const fields = employeeFields(formData);
  if (!fields.name) fail(back, "Name the employee");

  const { adminCountry } = await import("@/modules/countries/lib");
  const active = (await adminCountry()).active;
  if (!active) fail(back, "Pick a country first");

  // The login is optional — some staff never touch the console.
  let userId: string | null = null;
  const username = String(formData.get("username") ?? "").trim();
  if (username) {
    const password = String(formData.get("password") ?? "");
    const roleId = String(formData.get("role_id") ?? "");
    if (password.length < 6) fail(back, "The password needs at least 6 characters");
    if (!roleId) fail(back, "Pick the login's role");
    const { data: u, error: userError } = await db()
      .from("users")
      .insert({
        username,
        password_hash: await hashPassword(password),
        name: fields.name,
        email: fields.email,
        role_id: roleId,
        must_change_password: true,
      })
      .select("id")
      .single();
    if (userError || !u)
      fail(back, userError?.message.includes("duplicate") ? "That username is taken" : `Login failed: ${userError?.message}`);
    userId = u.id;
  }

  const { data, error } = await db()
    .from("employees")
    .insert({
      ...fields,
      country_id: active.id,
      currency: active.currency ?? null,
      user_id: userId,
      created_by: cu.user.id,
    })
    .select("id")
    .single();
  if (error || !data) fail(back, `Failed to create: ${error?.message ?? "unknown"}`);
  revalidatePath("/admin/hr");
  redirect(`/admin/hr/${data.id}`);
}

export async function updateEmployee(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "edit");
  if (cu.merchant) redirect("/m");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/hr/${id}`;
  const fields = employeeFields(formData);
  if (!fields.name) fail(back, "Name the employee");

  const { error } = await db()
    .from("employees")
    .update({ ...fields, updated_at: new Date().toISOString(), updated_by: cu.user.id })
    .eq("id", id);
  if (error) fail(back, `Failed to save: ${error.message}`);
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

/** Probation → active, or out the door — leaving switches the login off too. */
export async function setEmployeeStatus(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "edit");
  if (cu.merchant) redirect("/m");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/hr/${id}`;
  const status = String(formData.get("status") ?? "") as EmployeeStatus;
  if (!["probation", "active", "resigned", "terminated"].includes(status)) fail(back, "Unknown status");

  const { data: emp } = await db().from("employees").select("user_id").eq("id", id).maybeSingle();
  if (!emp) fail(back, "Employee not found");

  const leaving = !isOnPayroll(status);
  await db()
    .from("employees")
    .update({
      status,
      left_on: leaving ? String(formData.get("left_on") ?? "") || new Date().toISOString().slice(0, 10) : null,
      updated_at: new Date().toISOString(),
      updated_by: cu.user.id,
    })
    .eq("id", id);
  if (emp.user_id) await db().from("users").update({ active: !leaving }).eq("id", emp.user_id);
  revalidatePath(back);
  redirect(back);
}

/** Give an existing employee a console login after the fact. */
export async function createEmployeeLogin(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "edit");
  if (cu.merchant) redirect("/m");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/hr/${id}`;
  const username = String(formData.get("username") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const roleId = String(formData.get("role_id") ?? "");
  if (!username) fail(back, "Pick a username");
  if (password.length < 6) fail(back, "The password needs at least 6 characters");
  if (!roleId) fail(back, "Pick the role");

  const { data: emp } = await db().from("employees").select("name, email, user_id, status").eq("id", id).maybeSingle();
  if (!emp) fail(back, "Employee not found");
  if (emp.user_id) fail(back, "They already have a login");
  if (!isOnPayroll(emp.status as EmployeeStatus)) fail(back, "They have left — no login for the departed");

  const { data: u, error } = await db()
    .from("users")
    .insert({
      username,
      password_hash: await hashPassword(password),
      name: emp.name,
      email: emp.email,
      role_id: roleId,
      must_change_password: true,
    })
    .select("id")
    .single();
  if (error || !u) fail(back, error?.message.includes("duplicate") ? "That username is taken" : `Failed: ${error?.message}`);
  await db().from("employees").update({ user_id: u.id }).eq("id", id);
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

// ---------- Documents ----------

export async function uploadEmployeeDocument(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "edit");
  if (cu.merchant) redirect("/m");
  const id = String(formData.get("employee_id") ?? "");
  const back = `/admin/hr/${id}`;
  const name = String(formData.get("name") ?? "").trim();
  const file = formData.get("file");
  if (!name) fail(back, "Name the document");
  if (!(file instanceof File) || file.size === 0) fail(back, "Pick the file");
  if (file.size > 20 * 1024 * 1024) fail(back, "Documents must be under 20MB");

  const path = await uploadFile(DOCS_BUCKET, `employees/${id}/${Date.now()}.${fileExt(file)}`, file);
  await db().from("employee_documents").insert({ employee_id: id, name, path, uploaded_by: cu.user.id });
  revalidatePath(back);
  redirect(back);
}

export async function deleteEmployeeDocument(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "delete");
  if (cu.merchant) redirect("/m");
  const id = String(formData.get("employee_id") ?? "");
  await db().from("employee_documents").delete().eq("id", String(formData.get("id") ?? ""));
  revalidatePath(`/admin/hr/${id}`);
  redirect(`/admin/hr/${id}`);
}

// ---------- Payroll ----------

/** Open a month: one item per person on the books, seeded at their base. */
export async function createPayrollRun(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "add");
  if (cu.merchant) redirect("/m");
  const back = "/admin/hr/payroll";
  const month = String(formData.get("period_month") ?? "");
  if (!/^\d{4}-\d{2}$/.test(month)) fail(back, "Pick the month");

  const { adminCountry } = await import("@/modules/countries/lib");
  const active = (await adminCountry()).active;
  if (!active) fail(back, "Pick a country first");

  const { data: run, error } = await db()
    .from("payroll_runs")
    .insert({ country_id: active.id, period_month: `${month}-01`, created_by: cu.user.id })
    .select("id")
    .single();
  if (error || !run)
    fail(back, error?.message.includes("duplicate") ? "That month already has a run" : `Failed: ${error?.message}`);

  const { data: staff } = await db()
    .from("employees")
    .select("id, base_salary")
    .eq("country_id", active.id)
    .in("status", ["probation", "active"]);
  const items = ((staff ?? []) as { id: string; base_salary: number }[]).map((e) => ({
    run_id: run.id,
    employee_id: e.id,
    base_salary: e.base_salary,
  }));
  if (items.length) await db().from("payroll_items").insert(items);

  revalidatePath(back);
  redirect(`/admin/hr/payroll/${run.id}`);
}

export async function savePayrollItem(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "edit");
  if (cu.merchant) redirect("/m");
  const runId = String(formData.get("run_id") ?? "");
  const back = `/admin/hr/payroll/${runId}`;

  const { data: run } = await db().from("payroll_runs").select("status").eq("id", runId).maybeSingle();
  if (!run) fail(back, "Run not found");
  if (run.status !== "draft") fail(back, "This run is confirmed — it no longer changes");

  await db()
    .from("payroll_items")
    .update({
      base_salary: num(formData.get("base_salary")),
      bonus: num(formData.get("bonus")),
      deduction: num(formData.get("deduction")),
      note: str(formData.get("note")),
    })
    .eq("id", String(formData.get("id") ?? ""))
    .eq("run_id", runId);
  revalidatePath(back);
  redirect(back);
}

export async function confirmPayrollRun(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "edit");
  if (cu.merchant) redirect("/m");
  const id = String(formData.get("id") ?? "");
  const back = `/admin/hr/payroll/${id}`;

  await db()
    .from("payroll_runs")
    .update({ status: "confirmed", confirmed_at: new Date().toISOString(), confirmed_by: cu.user.id })
    .eq("id", id)
    .eq("status", "draft");
  revalidatePath(back);
  redirect(`${back}?saved=1`);
}

export async function deletePayrollRun(formData: FormData): Promise<void> {
  const { cu } = await requirePerm("hr", "delete");
  if (cu.merchant) redirect("/m");
  const id = String(formData.get("id") ?? "");
  const { data: run } = await db().from("payroll_runs").select("status").eq("id", id).maybeSingle();
  if (run && run.status !== "draft") fail(`/admin/hr/payroll/${id}`, "A confirmed run stays on the record");
  await db().from("payroll_runs").delete().eq("id", id);
  revalidatePath("/admin/hr/payroll");
  redirect("/admin/hr/payroll");
}
