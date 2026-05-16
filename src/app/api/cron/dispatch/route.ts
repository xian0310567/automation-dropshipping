import { authorizeCronRequest } from "@/server/cron/auth";
import {
  claimNextJob,
  dispatchCronOnce,
  markJobFailed,
  markJobFinished,
  runRegisteredJob,
} from "@/server/cron/dispatcher";
import { createDb } from "@/server/db/client";
import { assertCronEnv, getServerEnv } from "@/server/env";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = authorizeCronRequest({
    authorization: request.headers.get("authorization"),
    cronSecret: process.env.CRON_SECRET,
  });

  if (!auth.ok) {
    return Response.json({ error: auth.message }, { status: auth.status });
  }

  try {
    assertCronEnv();
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Cron env is not configured" },
      { status: 503 },
    );
  }

  const db = createDb();
  const env = getServerEnv();
  const leaseOwner = `vercel-cron:${crypto.randomUUID()}`;
  const result = await dispatchCronOnce({
    leaseOwner,
    claimJob: () => claimNextJob(db, leaseOwner),
    runJob: (job) => runRegisteredJob(job, { db, env }),
    markJobFinished: (job, runResult) => markJobFinished(db, job, runResult),
    markJobFailed: (job, error) => markJobFailed(db, job, error),
  });

  return Response.json({
    ok: true,
    ...result,
    budgetSeconds: 240,
    message: "Cron dispatcher authenticated and job lease acquisition completed.",
  });
}
