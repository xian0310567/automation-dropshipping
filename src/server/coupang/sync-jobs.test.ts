import { describe, expect, it } from "vitest";
import {
  buildCoupangInitialSyncJobSpecs,
  COUPANG_SYNC_JOB_TYPES,
  getCoupangFailureScheduledFor,
  getCoupangNextScheduledFor,
  prepareCoupangCheckpointForNextRun,
  runCoupangSyncJob,
  summarizeCoupangSyncJobs,
} from "./sync-jobs";
import { CoupangApiError } from "./coupang-client";

describe("Coupang sync jobs", () => {
  it("builds one idempotent initial job for each operational collection lane", () => {
    const now = new Date("2026-05-16T07:15:00.000Z");
    const specs = buildCoupangInitialSyncJobSpecs({
      tenantId: "tenant-1",
      now,
    });

    expect(specs.map((spec) => spec.type)).toEqual(COUPANG_SYNC_JOB_TYPES);
    expect(new Set(specs.map((spec) => spec.idempotencyKey)).size).toBe(3);
    expect(specs.map((spec) => spec.scheduledFor)).toEqual([now, now, now]);
    expect(specs.map((spec) => spec.checkpoint)).toEqual([
      {
        provider: "coupang",
        syncKind: "orders",
        stage: "queued",
        cursor: null,
      },
      {
        provider: "coupang",
        syncKind: "products",
        stage: "queued",
        cursor: null,
      },
      {
        provider: "coupang",
        syncKind: "cs",
        stage: "queued",
        cursor: null,
      },
    ]);
  });

  it("keeps legacy preparation jobs executable during rollout", async () => {
    const result = await runCoupangSyncJob({
      job: {
        id: "job-1",
        tenantId: "tenant-1",
        type: "coupang.orders.collection.prepare",
        checkpoint: {
          provider: "coupang",
          syncKind: "orders",
          stage: "queued",
          cursor: null,
        },
        leaseOwner: "worker-1",
      },
      now: new Date("2026-05-16T07:20:00.000Z"),
    });

    expect(result).toEqual({
      status: "succeeded",
      processedCount: 0,
      checkpoint: {
        provider: "coupang",
        syncKind: "orders",
        stage: "ready_for_collection",
        cursor: null,
        preparedAt: "2026-05-16T07:20:00.000Z",
        operatorMessage: "쿠팡 주문 수집 준비가 완료되었습니다.",
      },
    });
  });

  it("requires runtime dependencies for live collection jobs", async () => {
    await expect(
      runCoupangSyncJob({
        job: {
          id: "job-1",
          tenantId: "tenant-1",
          type: "coupang.orders.collect",
          checkpoint: {
            provider: "coupang",
            syncKind: "orders",
            stage: "queued",
            cursor: null,
          },
          leaseOwner: "worker-1",
        },
      }),
    ).rejects.toThrow(/database and environment/i);
  });

  it("keeps current collection jobs recurring after a successful run", () => {
    const now = new Date("2026-05-16T07:30:00.000Z");

    expect(
      getCoupangNextScheduledFor({
        jobType: "coupang.orders.collect",
        now,
      })?.toISOString(),
    ).toBe("2026-05-16T07:40:00.000Z");
    expect(
      getCoupangNextScheduledFor({
        jobType: "coupang.products.collect",
        now,
      })?.toISOString(),
    ).toBe("2026-05-16T08:30:00.000Z");
    expect(
      prepareCoupangCheckpointForNextRun({
        jobType: "coupang.orders.collect",
        checkpoint: {
          provider: "coupang",
          syncKind: "orders",
          stage: "collected",
          cursor: null,
          windowStart: "2026-05-16T16:00+09:00",
          windowEnd: "2026-05-16T16:30+09:00",
        },
      }),
    ).toMatchObject({
      provider: "coupang",
      syncKind: "orders",
      stage: "queued",
      cursor: null,
      windowStart: "2026-05-16T16:30+09:00",
    });
  });

  it("backs off live Coupang collection jobs when the provider rate-limits", () => {
    const now = new Date("2026-05-16T07:30:00.000Z");
    const error = new CoupangApiError("rate limited", 429, undefined, 90_000);

    expect(
      getCoupangFailureScheduledFor({
        attempts: 1,
        error,
        jobType: "coupang.orders.collect",
        now,
      })?.toISOString(),
    ).toBe("2026-05-16T07:31:30.000Z");
    expect(
      getCoupangFailureScheduledFor({
        attempts: 3,
        error: new Error("temporary"),
        jobType: "coupang.orders.collect",
        now,
      })?.toISOString(),
    ).toBe("2026-05-16T07:34:00.000Z");
  });

  it("summarizes visible sync status without leaking implementation wording", () => {
    const summary = summarizeCoupangSyncJobs([
      {
        type: "coupang.orders.collect",
        status: "queued",
        lastError: null,
        updatedAt: new Date("2026-05-16T07:10:00.000Z"),
      },
      {
        type: "coupang.products.collection.prepare",
        status: "succeeded",
        lastError: null,
        updatedAt: new Date("2026-05-16T07:11:00.000Z"),
      },
      {
        type: "coupang.cs.collection.prepare",
        status: "retrying",
        lastError: "temporarily unavailable",
        updatedAt: new Date("2026-05-16T07:12:00.000Z"),
      },
    ]);

    expect(summary.headline).toBe("확인이 필요한 작업이 있습니다.");
    expect(summary.items.map((item) => [item.label, item.statusLabel])).toEqual([
      ["주문 수집", "대기 중"],
      ["상품 확인", "수집 완료"],
      ["문의 확인", "다시 시도 중"],
    ]);
    expect(summary.latestIssue).toBe("문의 확인 작업을 다시 시도하고 있습니다.");
  });
});
