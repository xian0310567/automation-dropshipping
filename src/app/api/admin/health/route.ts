import { sql } from "drizzle-orm";
import { authorizeOperatorRequest } from "@/server/auth/operator";
import { createDb } from "@/server/db/client";
import { getServerEnv } from "@/server/env";
import {
  buildProductionHealthReport,
  type ProductionHealthEnv,
} from "@/server/health/production-health";

export const dynamic = "force-dynamic";

type QueueStatusRow = {
  status?: unknown;
  count?: unknown;
};

export async function GET(request: Request) {
  const auth = authorizeOperatorRequest(request);

  if (!auth.ok) {
    return Response.json(
      {
        ok: false,
        error: auth.message,
      },
      {
        status: auth.status,
      },
    );
  }

  const env = getServerEnv();
  const startedAt = Date.now();
  let database = {
    ok: false,
    latencyMs: null as number | null,
  };
  let queue = {
    queued: 0,
    retrying: 0,
    deadLettered: 0,
  };

  try {
    const db = createDb();

    await db.execute(sql`select 1`);
    database = {
      ok: true,
      latencyMs: Date.now() - startedAt,
    };

    const result = await db.execute(sql`
      SELECT status, count(*)::int AS count
      FROM jobs
      WHERE status IN ('queued', 'retrying', 'dead_lettered')
      GROUP BY status;
    `);
    queue = parseQueueStatusRows(getRows(result));
  } catch {
    database = {
      ok: false,
      latencyMs: null,
    };
  }

  const report = buildProductionHealthReport({
    now: new Date(),
    env: env as ProductionHealthEnv,
    database,
    queue,
  });

  return Response.json(report, {
    status: report.ok ? 200 : 503,
  });
}

function parseQueueStatusRows(rows: QueueStatusRow[]) {
  const queue = {
    queued: 0,
    retrying: 0,
    deadLettered: 0,
  };

  for (const row of rows) {
    const count = Number(row.count ?? 0);

    if (row.status === "queued") {
      queue.queued = count;
    }

    if (row.status === "retrying") {
      queue.retrying = count;
    }

    if (row.status === "dead_lettered") {
      queue.deadLettered = count;
    }
  }

  return queue;
}

function getRows(result: unknown): QueueStatusRow[] {
  if (Array.isArray(result)) {
    return result as QueueStatusRow[];
  }

  if (
    result &&
    typeof result === "object" &&
    "rows" in result &&
    Array.isArray(result.rows)
  ) {
    return result.rows as QueueStatusRow[];
  }

  return [];
}
