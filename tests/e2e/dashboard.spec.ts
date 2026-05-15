import { spawn, type ChildProcess } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";
import { expect, test, type Page } from "@playwright/test";

async function signIn(
  page: Page,
  next = "/app",
  options: {
    email?: string;
    role?: "owner" | "admin" | "operator" | "viewer";
    tenantName?: string;
  } = {},
) {
  await page.goto(`/sign-in?next=${encodeURIComponent(next)}`);
  await page.getByLabel("이메일").fill(options.email ?? "operator@example.com");
  await page.getByLabel("워크스페이스").fill(options.tenantName ?? "Demo Seller");
  await page
    .locator('input[name="role"]')
    .evaluate(
      (element, role) => {
        (element as HTMLInputElement).value = role;
      },
      options.role ?? "owner",
    );
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

async function startLockedBootstrapServer(port: number) {
  const output: string[] = [];
  const server = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION: "false",
      AUTH_PROVIDER_MODE: "development",
      BLOB_READ_WRITE_TOKEN: "playwright-blob-token",
      CRON_SECRET: "playwright-cron-secret",
      DATABASE_DIRECT_URL: "postgres://playwright-direct",
      DATABASE_URL: "postgres://playwright-runtime",
      E2E_TEST_MODE: "false",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "",
      OPERATOR_ACTOR_ID: "playwright-operator",
      OPERATOR_API_KEY: "playwright-operator-key",
      PII_ENCRYPTION_KEY: "playwright-pii-key",
      PORT: String(port),
      VERCEL_ENV: "production",
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  server.stdout?.on("data", (chunk) => output.push(String(chunk)));
  server.stderr?.on("data", (chunk) => output.push(String(chunk)));

  const baseURL = `http://127.0.0.1:${port}`;

  try {
    await waitForServer(baseURL, server, output);
  } catch (error) {
    await stopServer(server);
    throw error;
  }

  return {
    baseURL,
    stop: () => stopServer(server),
  };
}

async function waitForServer(
  baseURL: string,
  server: ChildProcess,
  output: string[],
) {
  const deadline = Date.now() + 30_000;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(
        `Locked bootstrap server exited early.\n${output.join("").slice(-4000)}`,
      );
    }

    try {
      const response = await fetch(`${baseURL}/sign-in`);
      if (response.ok) {
        return;
      }
    } catch {
      // Wait until next start opens the port.
    }

    await delay(250);
  }

  throw new Error(
    `Timed out waiting for locked bootstrap server.\n${output.join("").slice(-4000)}`,
  );
}

async function stopServer(server: ChildProcess) {
  if (server.exitCode !== null) {
    return;
  }

  server.kill("SIGTERM");
  await Promise.race([
    new Promise<void>((resolve) => server.once("exit", () => resolve())),
    delay(5_000).then(() => {
      if (server.exitCode === null) {
        server.kill("SIGKILL");
      }
    }),
  ]);
}

test.describe("Korean consignment operations UI", () => {
  test("keeps public production bootstrap locked when development sessions are disabled", async ({
    browser,
  }, testInfo) => {
    const lockedServer = await startLockedBootstrapServer(3200 + testInfo.workerIndex);
    const context = await browser.newContext();

    try {
      const page = await context.newPage();

      await page.goto(`${lockedServer.baseURL}/sign-in`);
      await expect(page.locator('[data-reference="YA9gq"]')).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "운영 워크스페이스에 로그인" }),
      ).toBeVisible();
      await expect(page.getByText("현재 인증 설정이 완료되지 않았습니다.")).toBeVisible();
      await expect(page.getByLabel("이메일")).toHaveCount(0);
      await expect(page.getByRole("button", { name: "대시보드로 이동" })).toHaveCount(0);

      await page.goto(`${lockedServer.baseURL}/sign-up`);
      await expect(page.locator('[data-reference="ypY4e"]')).toBeVisible();
      await expect(page.getByText("현재 인증 설정이 완료되지 않았습니다.")).toBeVisible();
      await expect(page.getByRole("button", { name: "온보딩 시작" })).toHaveCount(0);

      await page.goto(`${lockedServer.baseURL}/app`);
      await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
      await expect(page.getByText("현재 인증 설정이 완료되지 않았습니다.")).toBeVisible();
    } finally {
      await context.close();
      await lockedServer.stop();
    }
  });

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
      ["/app/integrations", "jnl9R", "마켓 연동", "쿠팡 연결 저장", "공급사·마켓"],
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

  test("lets owners review the Coupang marketplace connection flow", async ({
    page,
  }) => {
    await signIn(page, "/app/integrations", {
      email: "coupang-owner@example.com",
      tenantName: "Coupang Owner Seller",
    });
    const integrations = page.locator('[data-reference="jnl9R"]');

    await expect(integrations).toBeVisible();
    await expect(
      integrations.getByRole("heading", { name: "마켓 연동" }),
    ).toBeVisible();
    await expect(
      integrations.getByRole("heading", { name: "쿠팡 WING Open API" }),
    ).toBeVisible();
    await expect(integrations.getByText("연결 필요").first()).toBeVisible();
    await expect(integrations.getByLabel("판매자 ID")).toBeVisible();
    await expect(integrations.getByLabel("Access Key")).toBeVisible();
    await expect(integrations.getByLabel("Secret Key")).toHaveValue("");
    await expect(
      integrations.getByRole("link", { name: "WING에서 키 확인" }),
    ).toHaveAttribute("href", "https://wing.coupang.com");
    await expectStableLnb(page, "공급사·마켓");

    await integrations.getByRole("button", { name: "쿠팡 연결 저장" }).click();

    await expect(integrations.getByRole("alert")).toContainText(
      "입력값을 확인해주세요.",
    );
    await expect(integrations.getByText("쿠팡 판매자 ID를 입력해주세요.")).toBeVisible();
    await expect(integrations.getByLabel("Secret Key")).toHaveValue("");

    await integrations.getByLabel("판매자 ID").fill("A00123456");
    await integrations.getByLabel("연동 이름").fill("본점 쿠팡");
    await integrations.getByLabel("Access Key").fill("coupang-access-key");
    await integrations.getByLabel("Secret Key").fill("coupang-secret-key");
    await integrations.getByRole("button", { name: "쿠팡 연결 저장" }).click();

    await expect(integrations.getByRole("status")).toContainText(
      "쿠팡 연동 정보를 안전하게 저장했습니다.",
    );
    await page.reload();
    await expect(integrations.getByText("연결됨").first()).toBeVisible();
    await expect(integrations.getByText("A00****56")).toBeVisible();
    await expect(integrations.getByLabel("Secret Key")).toHaveValue("");

    await integrations.getByRole("button", { name: "쿠팡 연결 해제" }).click();
    await page.reload();
    await expect(integrations.getByText("연결 필요").first()).toBeVisible();
    await expect(integrations.getByText("미입력")).toBeVisible();
    await expectNoDeveloperCopy(page);
  });

  test("keeps Coupang credential controls disabled for non-managers", async ({
    page,
  }) => {
    await signIn(page, "/app/integrations", {
      email: "viewer@example.com",
      role: "viewer",
      tenantName: "Viewer Seller",
    });
    const integrations = page.locator('[data-reference="jnl9R"]');

    await expect(integrations).toBeVisible();
    await expect(
      integrations.getByText("연동 변경은 소유자 또는 관리자만 할 수 있습니다."),
    ).toBeVisible();
    await expect(
      integrations.getByRole("button", { name: "쿠팡 연결 저장" }),
    ).toBeDisabled();
    await expect(
      integrations.getByRole("button", { name: "쿠팡 연결 해제" }),
    ).toBeDisabled();
    await expectNoDeveloperCopy(page);
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
