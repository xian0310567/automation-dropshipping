import { redirect } from "next/navigation";
import { clearAuthSessionCookie } from "@/server/auth/session";

export async function GET() {
  await clearAuthSessionCookie();
  redirect("/sign-in");
}
