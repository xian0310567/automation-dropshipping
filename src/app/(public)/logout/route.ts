import { redirect } from "next/navigation";
import { clearDevelopmentSessionCookie } from "@/server/auth/session";

export async function GET() {
  await clearDevelopmentSessionCookie();
  redirect("/sign-in");
}
