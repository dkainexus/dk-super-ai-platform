"use client";

import { useActionState } from "react";
import { updateProfileAction, type ProfileState } from "@/app/actions/auth";
import { SaveButton } from "@/components/action-buttons";

export function ProfileForm({
  initial,
}: {
  initial: { username: string; email: string; name: string };
}) {
  const [state, action] = useActionState<ProfileState, FormData>(updateProfileAction, {});

  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs text-muted">Username</label>
        <input name="username" defaultValue={initial.username} className="input mono-num" required />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Display Name</label>
        <input name="name" defaultValue={initial.name} className="input" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Email</label>
        <input name="email" type="email" defaultValue={initial.email} className="input mono-num" />
      </div>
      <div>
        <label className="mb-1 block text-xs text-muted">Avatar (square, ≤2MB)</label>
        <input name="avatar" type="file" accept="image/*" className="input" />
      </div>
      {state.error && <p className="text-sm text-danger sm:col-span-2">{state.error}</p>}
      {state.ok && <p className="text-sm text-success sm:col-span-2">Profile updated ✓</p>}
      <div className="sm:col-span-2">
        <SaveButton tip="Save profile changes" />
      </div>
    </form>
  );
}
