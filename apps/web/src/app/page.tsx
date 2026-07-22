import { redirect } from "next/navigation";
import { getSessionUser, homePath } from "@/lib/auth";

export default async function RootPage() {
  const su = await getSessionUser();
  redirect(su ? homePath(su) : "/login");
}
