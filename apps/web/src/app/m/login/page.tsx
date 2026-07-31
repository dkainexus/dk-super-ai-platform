import { redirect } from "next/navigation";

// One door for everyone now — /login.
export default function OldMerchantLogin() {
  redirect("/login");
}
