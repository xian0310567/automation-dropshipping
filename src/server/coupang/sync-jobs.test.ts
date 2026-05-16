import { describe, expect, it } from "vitest";
import {
  buildCoupangInitialSyncJobSpecs,
  COUPANG_SYNC_JOB_TYPES,
  runCoupangSyncJob,
  summarizeCoupangSyncJobs,
} from "./sync-jobs";

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

  it("prepares a durable checkpoint when a Coupang sync job is dispatched", async () => {
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

  it("summarizes visible sync status without leaking implementation wording", () => {
    const summary = summarizeCoupangSyncJobs([
      {
        type: "coupang.orders.collection.prepare",
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
      ["상품 확인", "준비 완료"],
      ["문의 확인", "다시 시도 중"],
    ]);
    expect(summary.latestIssue).toBe("문의 확인 작업을 다시 시도하고 있습니다.");
  });
});
