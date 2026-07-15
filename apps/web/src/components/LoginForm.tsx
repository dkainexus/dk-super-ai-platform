"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { loginAction, type AuthState } from "@/app/actions/auth";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full" disabled={pending}>
      {pending ? "…" : "登录"}
    </button>
  );
}

export function LoginForm() {
  const [state, action] = useActionState<AuthState, FormData>(loginAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      <div>
        <label className="block text-sm mb-1" htmlFor="username">
          用户名
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          className="input w-full"
          required
        />
      </div>
      <div>
        <label className="block text-sm mb-1" htmlFor="password">
          密码
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          className="input w-full"
          required
        />
      </div>
      {state.error && <p className="text-sm text-red-400">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
