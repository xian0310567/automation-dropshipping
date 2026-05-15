import { getServerEnv } from "@/server/env";
import { getClerkReadiness, resolveAuthMode } from "@/server/auth/session-core";

export async function AuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const env = getServerEnv();

  if (resolveAuthMode(env) !== "clerk" || !getClerkReadiness(env).ok) {
    return children;
  }

  const { ClerkProvider } = await import("@clerk/nextjs");

  return <ClerkProvider>{children}</ClerkProvider>;
}
