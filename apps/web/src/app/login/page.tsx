import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/LoginForm";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect(user.must_change_password ? "/change-password" : "/dashboard");

  return (
    <main className="min-h-dvh flex items-center justify-center px-5">
      <div className="w-full max-w-sm">
        <h1 className="text-2xl mb-6 text-center">DK Super AI</h1>
        <div className="card p-6">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
