import { JOB_INVOCATION_BUDGET_MS } from "./job-policy";

export type JobCheckpoint = Record<string, unknown>;

export type BoundedJobStepResult = {
  checkpoint: JobCheckpoint;
  processedCount: number;
  done: boolean;
};

export type BoundedJobResult = {
  status: "succeeded" | "checkpointed";
  checkpoint: JobCheckpoint;
  processedCount: number;
};

export async function runBoundedJob(input: {
  startedAt?: Date;
  checkpoint: JobCheckpoint;
  now?: () => Date;
  handler: (state: {
    checkpoint: JobCheckpoint;
  }) => Promise<BoundedJobStepResult>;
}): Promise<BoundedJobResult> {
  const now = input.now ?? (() => new Date());
  const startedAt = input.startedAt ?? now();
  let checkpoint = input.checkpoint;
  let processedCount = 0;

  while (now().getTime() - startedAt.getTime() < JOB_INVOCATION_BUDGET_MS) {
    const step = await input.handler({ checkpoint });
    checkpoint = step.checkpoint;
    processedCount += step.processedCount;

    if (step.done) {
      return { status: "succeeded", checkpoint, processedCount };
    }
  }

  return { status: "checkpointed", checkpoint, processedCount };
}
