import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function ChangePasswordPage() {
  const cu = await getCurrentUser();
  if (!cu) redirect("/login");
  const mustChange = cu.user.must_change_password;

  return (
    <main className="flex min-h-dvh items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="mb-2 text-center text-2xl font-semibold">
          {mustChange ? "Set a New Password" : "Change Password"}
        </h1>
        {mustChange && (
          <p className="mb-4 text-center text-sm text-muted">
            First sign-in: choose a new password. You will use it from now on.
          </p>
        )}
        <div className="card p-6">
          <ChangePasswordForm requireCurrent={!mustChange} />
        </div>
      </div>
    </main>
  );
}
