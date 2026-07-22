import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function ChangePasswordPage() {
  const su = await getSessionUser();
  if (!su) redirect("/login");
  const mustChange = su.kind === "staff" ? su.staff.must_change_password : su.user.must_change_password;

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold">
          {mustChange ? "设置新密码" : "修改密码"}
        </h1>
        {mustChange && (
          <p className="mb-4 text-center text-sm text-muted">首次登录需要设置一个新密码，之后用新密码登录。</p>
        )}
        <div className="card p-6">
          <ChangePasswordForm requireCurrent={!mustChange} />
        </div>
      </div>
    </main>
  );
}
