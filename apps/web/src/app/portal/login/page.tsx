import { redirect } from "next/navigation";

// One door for everyone now — /login.
export default function OldPortalLogin() {
  redirect("/login");
}
