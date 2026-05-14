export type CronAuthorizationResult =
  | { ok: true; status: 200 }
  | { ok: false; status: 401; message: string };

export function authorizeCronRequest(input: {
  authorization: string | null | undefined;
  cronSecret: string | null | undefined;
}): CronAuthorizationResult {
  if (!input.cronSecret) {
    return { ok: false, status: 401, message: "CRON_SECRET is not configured" };
  }

  if (input.authorization !== `Bearer ${input.cronSecret}`) {
    return { ok: false, status: 401, message: "Invalid cron authorization" };
  }

  return { ok: true, status: 200 };
}
