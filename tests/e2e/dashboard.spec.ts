import { expect, test, type Page } from "@playwright/test";

async function signIn(page: Page, next = "/app") {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("이메일").fill("operator@example.com");
  await page.getByLabel("이름").fill("운영자");
  await page.getByLabel("워크스페이스").fill("Demo Seller");
  await page.getByRole("button", { name: "개발 세션으로 로그인" }).click();
  await expect(page).toHaveURL(new RegExp(`${next}$`));
}

test.describe("SaaS auth and operations dashboard", () => {
  test("redirects unauthenticated users away from the protected app", async ({
    page,
  }) => {
    await page.goto("/app");

    await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
    await expect(
      page.getByRole("heading", { name: "운영 워크스페이스에 로그인" }),
    ).toBeVisible();
  });

  test("lets a new user sign up and land in onboarding", async ({ page }) => {
    await page.goto("/sign-up");
    await page.getByLabel("이메일").fill("owner@example.com");
    await page.getByLabel("이름").fill("대표 운영자");
    await page.getByLabel("워크스페이스").fill("Demo Seller");
    await page.getByRole("button", { name: "워크스페이스 시작" }).click();

    await expect(page).toHaveURL(/\/app\/onboarding$/);
    await expect(page.getByRole("heading", { name: "SaaS 온보딩" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Demo Seller" })).toBeVisible();
    await expect(page.getByText("쿠팡 연동")).toBeVisible();
  });

  test("renders the protected daily order and CS operations surface", async ({
    page,
  }) => {
    await signIn(page);
    const sectionByHeading = (name: string) =>
      page.getByRole("heading", { name }).locator("xpath=ancestor::section[1]");

    await expect(page).toHaveTitle(/Coupang Ownerclan Ops/);
    await expect(
      page.getByRole("heading", { name: "주문·CS 자동화 대시보드" }),
    ).toBeVisible();
    await expect(page.getByText("주문/CS 운영 현황")).toBeVisible();
    await expect(page.getByText("Demo Seller 운영 워크스페이스")).toBeVisible();

    await expect(
      page.getByRole("button", { name: "주문 동기화" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "CS 답변 검토" })).toBeVisible();

    const expectedKpis = [
      ["신규 주문", "12"],
      ["발주 필요", "9"],
      ["CS 미답변", "18"],
      ["확인 필요", "210"],
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
    await expect(approvalQueue).toContainText("오너클랜 발주 필요");
    await expect(approvalQueue).toContainText("CS 답변 초안 확인");
    await expect(approvalQueue).toContainText("송장 업로드 실패");

    await expect(sectionByHeading("작업 상태")).toContainText(
      "다음 실행 01:00 UTC",
    );

    await expect(sectionByHeading("긴급 확인")).toContainText("CS 미답변 18건");
    await expect(sectionByHeading("긴급 확인")).toContainText("dead letter 1건");

    await expect(sectionByHeading("Fallback 지표")).toContainText(
      "Coupang 429 rate over 20%",
    );

    const readiness = sectionByHeading("연동 준비");
    await expect(readiness).toContainText("Vercel Cron bearer auth");
    await expect(readiness).toContainText("Coupang HMAC smoke test");
  });

  test("logs out and blocks the next protected navigation", async ({ page }) => {
    await signIn(page);
    await page.getByRole("link", { name: "로그아웃" }).click();

    await expect(page).toHaveURL(/\/sign-in$/);
    await page.goto("/app");
    await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
  });

  test("keeps the protected dashboard usable on a narrow mobile viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await signIn(page);

    await expect(
      page.getByRole("heading", { name: "주문·CS 자동화 대시보드" }),
    ).toBeInViewport();
    await expect(
      page.getByRole("button", { name: "주문 동기화" }),
    ).toBeInViewport();
    await expect(page.getByRole("button", { name: "CS 답변 검토" })).toBeInViewport();

    const scrollWidth = await page.evaluate(
      () => document.documentElement.scrollWidth,
    );
    const viewportWidth = page.viewportSize()?.width ?? 390;

    expect(scrollWidth).toBeLessThanOrEqual(viewportWidth + 1);
  });
});
