import { describe, expect, it } from "vitest";
import { runBoundedJob } from "./runner";

describe("runBoundedJob", () => {
  it("checkpoints before exceeding the serverless budget", async () => {
    let iterations = 0;
    const result = await runBoundedJob({
      startedAt: new Date("2026-05-14T00:00:00.000Z"),
      now: () =>
        new Date(
          iterations++ === 0
            ? "2026-05-14T00:03:50.000Z"
            : "2026-05-14T00:04:01.000Z",
        ),
      checkpoint: { cursor: 0 },
      handler: async ({ checkpoint }) => ({
        checkpoint: { cursor: Number(checkpoint.cursor) + 1 },
        processedCount: 1,
        done: false,
      }),
    });

    expect(result.status).toBe("checkpointed");
    expect(result.checkpoint).toEqual({ cursor: 1 });
    expect(result.processedCount).toBe(1);
  });
});
