import { requireUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function ChangePasswordPage() {
  await requireUser({ allowPasswordChange: true });

  return (
    <main className="min-h-dvh flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl mb-6 text-center">修改密码</h1>
        <div className="card p-6">
          <ChangePasswordForm />
        </div>
      </div>
    </main>
  );
}
