import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, next = "/app") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("이메일").fill("operator@example.com");
  await page.getByLabel("워크스페이스").fill("Demo Seller");
  await page.getByRole("button", { name: "대시보드로 이동" }).click();
  await expect(page).toHaveURL(new RegExp(`${next.replace(/\//g, "\\/")}$`));
}

async function expectNoDeveloperCopy(page: Page) {
  await expect(page.locator("body")).not.toContainText(
    /자동화|Fallback|Cron|HMAC|dead letter|DTO|Vercel|rate limit|raw upload|tenant schema/i,
  );
}

const stableNavLabels = [
  "오늘 처리",
  "주문",
  "CS",
  "취소·반품",
  "상품·재고",
  "가격·마진",
  "공급사·마켓",
  "작업 이력",
  "온보딩",
] as const;

async function expectStableLnb(page: Page, activeLabel: string) {
  const nav = page.getByRole("navigation", { name: "주요 메뉴" });

  await expect(nav).toBeVisible();

  for (const label of stableNavLabels) {
    await expect(nav.getByRole("link", { exact: true, name: label })).toBeVisible();
  }

  await expect(nav.getByRole("link", { exact: true, name: activeLabel })).toHaveAttribute(
    "aria-current",
    "page",
  );
  await expect(page.locator(".ops-sidebar")).toHaveCount(0);
}

test.describe("Korean consignment operations UI", () => {
  test("redirects unauthenticated users to the designed sign-in surface", async ({
    page,
  }) => {
    await page.goto("/app");

    await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
    await expect(page.locator('[data-reference="YA9gq"]')).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "운영 워크스페이스에 로그인" }),
    ).toBeVisible();
    await expect(page.getByText("오늘 승인 대기")).toBeVisible();
    await expectNoDeveloperCopy(page);
  });

  test("lets a new user sign up and land in onboarding", async ({ page }) => {
    await page.goto("/sign-up");

    await expect(page.locator('[data-reference="ypY4e"]')).toBeVisible();
    await page.getByLabel("이메일").fill("owner@example.com");
    await page.getByLabel("이름", { exact: true }).fill("대표 운영자");
    await page.getByLabel("워크스페이스 이름", { exact: true }).fill("Demo Seller");
    await page.getByRole("button", { name: "온보딩 시작" }).click();

    await expect(page).toHaveURL(/\/app\/onboarding$/);
    await expect(page.locator('[data-reference="wxMIN"]')).toBeVisible();
    await expect(page.getByRole("heading", { name: "연동 준비" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "쿠팡 연동" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "알림·확인 기준" })).toBeVisible();
    await expectStableLnb(page, "온보딩");
    await expectNoDeveloperCopy(page);
  });

  test("renders the protected today dashboard from the pen reference", async ({
    page,
  }) => {
    await signIn(page);
    const dashboard = page.locator('[data-reference="DkLfQ"]');

    await expect(page).toHaveTitle(/쿠팡 오너클랜 운영 모니터링/);
    await expect(dashboard).toBeVisible();
    await expect(dashboard.getByRole("heading", { name: "오늘 처리 대시보드" })).toBeVisible();
    await expect(dashboard.getByRole("button", { name: "전체 동기화" })).toBeVisible();
    await expect(dashboard.getByText("CS 긴급")).toBeVisible();
    await expect(dashboard.getByText("품절 위험 상품")).toBeVisible();
    await expect(dashboard.getByRole("link", { name: "답변 확인" })).toBeVisible();
    await expect(dashboard.getByRole("link", { name: "상품 보기" })).toBeVisible();
    await expectStableLnb(page, "오늘 처리");
    await expect(dashboard.locator('[data-slot="card"]').first()).toBeVisible();
    await expect(dashboard.locator('[data-slot="input"]')).toBeVisible();
    await expect(dashboard.locator('[data-slot="table"]')).toBeVisible();
    await expect(dashboard.locator('[data-slot="badge"]').first()).toBeVisible();
    await expect(dashboard.locator('[data-motion="table-row"]').first()).toBeVisible();
    await expect(page.locator('[data-motion="nav-item"]').first()).toBeVisible();

    const titleSize = await page
      .getByRole("heading", { name: "오늘 처리 대시보드" })
      .evaluate((element) => Number.parseFloat(getComputedStyle(element).fontSize));
    const firstRowHeight = await page
      .locator(".ops-table-row")
      .nth(1)
      .evaluate((element) => element.getBoundingClientRect().height);

    expect(titleSize).toBeLessThanOrEqual(26);
    expect(firstRowHeight).toBeLessThanOrEqual(76);
    const navLink = page
      .getByRole("navigation", { name: "주요 메뉴" })
      .getByRole("link", { name: "주문", exact: true });
    const navTransition = await navLink.evaluate((element) => getComputedStyle(element).transitionDuration);
    expect(navTransition).not.toBe("0s");
    await navLink.hover();
    await page.waitForTimeout(120);
    const navTransform = await navLink.evaluate((element) => getComputedStyle(element).transform);
    expect(navTransform).not.toBe("none");
    await expectNoDeveloperCopy(page);
  });

  test("covers the missing operational screens as real routes", async ({ page }) => {
    await signIn(page, "/app/orders");

    const routes = [
      ["/app/orders", "dhrCg", "주문 목록", "상세 검토", "주문"],
      ["/app/orders/review", "P3jyw1", "발주 승인 검토", "CSV 발주 승인", "주문"],
      ["/app/orders/approval", "mFQBl", "승인 상세 패널", "발주 승인", "주문"],
      ["/app/cs", "u347IV", "CS 인박스", "답변 검토", "CS"],
      ["/app/cs/detail", "LFAF9", "답변 초안 승인", "답변 발송", "CS"],
      ["/app/claims", "vf3YB", "취소·반품", "승인 검토", "취소·반품"],
      ["/app/integrations", "jnl9R", "공급사·마켓 상태", "연동 확인", "공급사·마켓"],
      ["/app/products", "Ro2UR", "상품·재고 모니터링", "무선 미니 가습기", "상품·재고"],
      ["/app/history", "H2Nuw", "작업 이력·알림", "이력 내보내기", "작업 이력"],
      ["/app/margins", "KiqBh", "가격·마진 모니터링", "가격 조정", "가격·마진"],
    ] as const;

    for (const [url, referenceId, heading, visibleText, activeLabel] of routes) {
      await page.goto(url);
      await expect(page.locator(`[data-reference="${referenceId}"]`)).toBeVisible();
      await expect(page.getByRole("heading", { name: heading })).toBeVisible();
      await expect(page.getByText(visibleText).first()).toBeVisible();
      await expectStableLnb(page, activeLabel);
      await expectNoDeveloperCopy(page);
    }
  });

  test("logs out and blocks the next protected navigation", async ({ page }) => {
    await signIn(page);
    await page.goto("/logout");

    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
  });

  test("keeps the today dashboard usable on a narrow mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);
    const mobileToday = page.locator('[data-reference="GlQOZ"]');

    await expect(mobileToday).toBeVisible();
    await expect(mobileToday.getByRole("heading", { name: "오늘 처리" })).toBeInViewport();
    await expect(mobileToday.getByRole("button", { name: "새로고침" })).toBeInViewport();
    await expect(page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "상품" })).toBeVisible();
    await expect(mobileToday.getByText("CS 위험")).toBeVisible();
    await expect(mobileToday.getByText("CS 답변 대기")).toBeVisible();
    await expect(page.getByRole("navigation", { name: "주요 메뉴" }).getByRole("link", { name: "취소·반품" })).toBeHidden();

    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const viewportWidth = page.viewportSize()?.width ?? 390;

    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
    await expectNoDeveloperCopy(page);
  });

  test("captures reference screenshots for pen-frame evidence", async ({
    page,
  }, testInfo) => {
    await page.setViewportSize({ width: 1440, height: 1024 });
    await page.goto("/");
    await expect(page.locator('[data-reference="n9rOC"]')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("n9rOC-landing-1440x1024.png"),
      fullPage: false,
    });

    await signIn(page);
    await expect(page.locator('[data-reference="DkLfQ"]')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("DkLfQ-dashboard-1440x1024.png"),
      fullPage: false,
    });

    await page.goto("/app/orders/review");
    await expect(page.locator('[data-reference="P3jyw1"]')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("P3jyw1-order-detail-1440x1024.png"),
      fullPage: false,
    });

    await page.goto("/app/products");
    await expect(page.locator('[data-reference="Ro2UR"]')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("Ro2UR-products-1440x1024.png"),
      fullPage: false,
    });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app");
    await expect(page.locator('[data-reference="GlQOZ"]')).toBeVisible();
    await page.screenshot({
      path: testInfo.outputPath("GlQOZ-mobile-today-390x844.png"),
      fullPage: false,
    });
  });
});
