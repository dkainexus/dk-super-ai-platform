"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePasswordAction, type AuthState } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "…" : "Update Password"}
    </button>
  );
}

export function ChangePasswordForm({ requireCurrent }: { requireCurrent: boolean }) {
  const [state, action] = useActionState<AuthState, FormData>(changePasswordAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {requireCurrent && (
        <div>
          <label className="mb-1 block text-sm" htmlFor="current">
            Current Password
          </label>
          <input id="current" name="current" type="password" autoComplete="current-password" className="input w-full" required />
        </div>
      )}
      <div>
        <label className="mb-1 block text-sm" htmlFor="next">
          New Password (min. 6 characters)
        </label>
        <input id="next" name="next" type="password" autoComplete="new-password" className="input w-full" required />
      </div>
      <div>
        <label className="mb-1 block text-sm" htmlFor="confirm">
          Confirm New Password
        </label>
        <input id="confirm" name="confirm" type="password" autoComplete="new-password" className="input w-full" required />
      </div>
      {state.error && <p className="text-sm text-danger">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
