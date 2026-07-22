/* eslint-disable @next/next/no-img-element */
import { requireUser } from "@/lib/auth";
import { Shell } from "@/components/shell";
import { signedUrl, ASSETS_BUCKET } from "@/lib/storage";
import { ProfileForm } from "@/components/ProfileForm";
import { ChangePasswordForm } from "@/components/ChangePasswordForm";

export default async function ProfilePage() {
  const cu = await requireUser();
  const avatarUrl = await signedUrl(ASSETS_BUCKET, cu.user.avatar_path);

  return (
    <Shell cu={cu}>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="h-14 w-14 rounded-full object-cover" />
          ) : (
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-lg font-semibold text-accent-strong">
              {(cu.user.name || cu.user.username).slice(0, 2).toUpperCase()}
            </span>
          )}
          <div>
            <h1 className="text-xl font-semibold">My Profile</h1>
            <p className="text-sm text-muted">
              {cu.isSuper ? "Superadmin" : cu.role?.name ?? "No role"}
              {cu.merchant ? ` · ${cu.merchant.name}` : " · Platform"}
            </p>
          </div>
        </div>

        <section className="card p-5">
          <h2 className="mb-4 text-sm font-semibold">Account</h2>
          <ProfileForm
            initial={{
              username: cu.user.username,
              email: cu.user.email ?? "",
              name: cu.user.name ?? "",
            }}
          />
        </section>

        <section className="card max-w-md p-5">
          <h2 className="mb-4 text-sm font-semibold">Change Password</h2>
          <ChangePasswordForm requireCurrent />
        </section>
      </div>
    </Shell>
  );
}
