import { expect, test } from "@playwright/test";

test.describe("operations dashboard", () => {
  test("renders the critical daily operations surface", async ({ page }) => {
    await page.goto("/");
    const sectionByHeading = (name: string) =>
      page.getByRole("heading", { name }).locator("xpath=ancestor::section[1]");

    await expect(page).toHaveTitle(/Coupang Ownerclan Ops/);
    await expect(
      page.getByRole("heading", { name: "쿠팡 × 오너클랜 운영 대시보드" }),
    ).toBeVisible();
    await expect(page.getByText("오늘의 운영 현황")).toBeVisible();

    await expect(
      page.getByRole("button", { name: "비위너 업로드" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "승인 실행" })).toBeVisible();

    const expectedKpis = [
      ["비위너 감지", "1,240"],
      ["판매중지 후보", "930"],
      ["확인 필요", "210"],
      ["신규 주문", "12"],
      ["취소/반품 경고", "2"],
      ["송장 실패", "2"],
    ];

    for (const [label, value] of expectedKpis) {
      const card = page.locator("article").filter({
        has: page.getByText(label, { exact: true }),
      });
      await expect(card).toContainText(value);
    }

    const approvalQueue = sectionByHeading("승인 대기 큐");

    await expect(approvalQueue).toContainText("210건");
    await expect(approvalQueue).toContainText("비위너 판매중지 후보");
    await expect(approvalQueue).toContainText("옵션 매칭 확인");
    await expect(approvalQueue).toContainText("송장 업로드 실패");

    await expect(sectionByHeading("작업 상태")).toContainText(
      "다음 실행 01:00 UTC",
    );

    await expect(sectionByHeading("긴급 확인")).toContainText("dead letter 1건");

    await expect(sectionByHeading("Fallback 지표")).toContainText(
      "Coupang 429 rate over 20%",
    );

    const readiness = sectionByHeading("연동 준비");
    await expect(readiness).toContainText("Vercel Cron bearer auth");
    await expect(readiness).toContainText("Coupang HMAC smoke test");
  });

  test("keeps the dashboard usable on a narrow mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await expect(
      page.getByRole("heading", { name: "쿠팡 × 오너클랜 운영 대시보드" }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "비위너 업로드" }),
    ).toBeInViewport();
    await expect(page.getByRole("button", { name: "승인 실행" })).toBeInViewport();

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const viewportWidth = page.viewportSize()?.width ?? 390;

    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });
});
