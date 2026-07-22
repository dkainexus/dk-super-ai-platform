import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function ChangePasswordPage() {
  const su = await getSessionUser();
  if (!su) redirect("/login");

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="mb-6 text-center text-2xl font-semibold">修改密码</h1>
        <div className="card p-6">
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
