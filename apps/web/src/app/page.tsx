import { redirect } from "next/navigation";
import { getCurrentUser, homePath } from "@/lib/auth";

export default async function RootPage() {
  const cu = await getCurrentUser();
  redirect(cu ? homePath(cu) : "/login");
}
