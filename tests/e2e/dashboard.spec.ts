import { spawn, type ChildProcess } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { neon } from "@neondatabase/serverless";
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

type DesignSyncManifest = {
  exportDir: string;
  frames: {
    height: number;
    referenceId: string;
    route: string;
    width: number;
  }[];
  scale: number;
};

const designSyncManifest = JSON.parse(
  readFileSync(`${process.cwd()}/design/sync-manifest.json`, "utf8"),
) as DesignSyncManifest;
const latestDesignExportDir = `${process.cwd()}/${designSyncManifest.exportDir}`;
const designFrameByReference = new Map(
  designSyncManifest.frames.map((frame) => [frame.referenceId, frame]),
);

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

async function expectHealthyVisualLayout(page: Page, context: string) {
  const report = await page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const scrollWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );
    const offenders = Array.from(
      document.querySelectorAll<HTMLElement>("body *"),
    )
      .filter((element) => {
        const style = getComputedStyle(element);
        if (
          style.display === "none" ||
          style.visibility === "hidden" ||
          style.opacity === "0"
        ) {
          return false;
        }

        const rect = element.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) {
          return false;
        }

        return rect.left < -1 || rect.right > viewportWidth + 1;
      })
      .slice(0, 5)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          className: element.className.toString(),
          tagName: element.tagName.toLowerCase(),
          text: element.textContent?.trim().slice(0, 60) ?? "",
          x: Math.round(rect.left),
          width: Math.round(rect.width),
        };
      });

    return {
      offenders,
      overflow: Math.round(scrollWidth - viewportWidth),
    };
  });

  expect(report.overflow, `${context} has horizontal document overflow`).toBeLessThanOrEqual(1);
  expect(report.offenders, `${context} has visible elements outside the viewport`).toEqual([]);
}

function expectDesignExport(referenceId: string) {
  const frame = designFrameByReference.get(referenceId);
  const exportPath = `${latestDesignExportDir}/${referenceId}.png`;

  expect(frame, `${referenceId} must be declared in /design/sync-manifest.json`).toBeTruthy();
  expect(existsSync(exportPath), `${referenceId} must have a synced /design export`).toBe(true);

  const image = readPngSize(exportPath);
  expect(
    image.width,
    `${referenceId} export width must match the pen frame at ${designSyncManifest.scale}x`,
  ).toBe(frame!.width * designSyncManifest.scale);
  expect(
    image.height,
    `${referenceId} export height must match the pen frame at ${designSyncManifest.scale}x`,
  ).toBe(frame!.height * designSyncManifest.scale);
  expect(
    image.byteLength,
    `${referenceId} must have a synced /design export`,
  ).toBeGreaterThan(10_000);
}

function readPngSize(path: string) {
  const buffer = readFileSync(path);
  const signature = buffer.subarray(0, 8).toString("hex");

  expect(signature, `${path} must be a PNG`).toBe("89504e470d0a1a0a");

  return {
    byteLength: buffer.byteLength,
    height: buffer.readUInt32BE(20),
    width: buffer.readUInt32BE(16),
  };
}

async function startPasswordAuthServer(port: number) {
  const output: string[] = [];
  const databaseUrl = getRequiredPasswordAuthDatabaseUrl("DATABASE_URL");
  const databaseDirectUrl = getRequiredPasswordAuthDatabaseUrl("DATABASE_DIRECT_URL");
  const server = spawn("pnpm", ["exec", "next", "start", "-p", String(port)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      AUTH_ALLOW_DEV_SESSION_IN_PRODUCTION: "false",
      AUTH_PROVIDER_MODE: "password",
      BLOB_READ_WRITE_TOKEN: "playwright-blob-token",
      CRON_SECRET: "playwright-cron-secret",
      DATABASE_DIRECT_URL: databaseDirectUrl,
      DATABASE_URL: databaseUrl,
      E2E_TEST_MODE: "false",
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

async function cleanupPasswordAuthAccount(email: string) {
  const sql = neon(getRequiredPasswordAuthDatabaseUrl("DATABASE_URL"));
  const userRows = (await sql`
    select id from users where email = ${email}
  `) as { id: string }[];

  for (const user of userRows) {
    const tenantRows = (await sql`
      select tenant_id from memberships where user_id = ${user.id}
    `) as { tenant_id: string }[];

    await sql`delete from auth_sessions where user_id = ${user.id}`;
    await sql`delete from password_credentials where user_id = ${user.id}`;
    await sql`delete from memberships where user_id = ${user.id}`;

    for (const tenant of tenantRows) {
      await sql`delete from dead_letters where tenant_id = ${tenant.tenant_id}`;
      await sql`delete from job_runs where tenant_id = ${tenant.tenant_id}`;
      await sql`delete from jobs where tenant_id = ${tenant.tenant_id}`;
      await sql`delete from audit_logs where tenant_id = ${tenant.tenant_id}`;
      await sql`delete from integration_accounts where tenant_id = ${tenant.tenant_id}`;
      await sql`delete from tenants where id = ${tenant.tenant_id}`;
    }

    await sql`delete from users where id = ${user.id}`;
  }
}

async function passwordAuthAccountExists(email: string) {
  const sql = neon(getRequiredPasswordAuthDatabaseUrl("DATABASE_URL"));
  const rows = (await sql`
    select id from users where email = ${email} limit 1
  `) as { id: string }[];

  return rows.length > 0;
}

async function getCoupangJobsForPasswordAuthAccount(email: string) {
  const sql = neon(getRequiredPasswordAuthDatabaseUrl("DATABASE_URL"));

  return (await sql`
    select jobs.type, jobs.status
    from users
    join memberships on memberships.user_id = users.id
    join jobs on jobs.tenant_id = memberships.tenant_id
    where users.email = ${email}
      and jobs.type in (
        'coupang.orders.collection.prepare',
        'coupang.products.collection.prepare',
        'coupang.cs.collection.prepare'
      )
    order by jobs.type asc
  `) as { type: string; status: string }[];
}

async function cleanupPasswordAuthThrottle(
  ipAddress: string,
  emails: string[] = [],
) {
  const sql = neon(getRequiredPasswordAuthDatabaseUrl("DATABASE_URL"));
  const keys = [
    buildAuthThrottleKeyForTest("sign-up", ipAddress),
    buildAuthThrottleKeyForTest("sign-in", ipAddress),
    ...emails.map((email) =>
      buildAuthThrottleKeyForTest("sign-in", ipAddress, email),
    ),
  ];

  for (const key of keys) {
    await sql`delete from auth_rate_limits where key = ${key}`;
  }
}

function buildAuthThrottleKeyForTest(
  action: "sign-in" | "sign-up",
  ipAddress: string,
  email?: string,
) {
  const normalizedEmail = email ? email.trim().toLowerCase() : "no-email";
  const digest = createHash("sha256")
    .update(`${action}:${ipAddress}:${normalizedEmail}`)
    .digest("hex");

  return `${action}:${digest}`;
}

async function fillPasswordSignupForm(
  page: Page,
  input: {
    email: string;
    name: string;
    tenantName: string;
    password: string;
  },
) {
  await page.getByLabel("이메일").fill(input.email);
  await page.getByLabel("이름", { exact: true }).fill(input.name);
  await page
    .getByLabel("워크스페이스 이름", { exact: true })
    .fill(input.tenantName);
  await page.getByLabel("비밀번호").fill(input.password);
}

async function submitPasswordSignup(
  page: Page,
  baseURL: string,
  input: {
    email: string;
    name: string;
    tenantName: string;
    password: string;
  },
) {
  await page.goto(`${baseURL}/sign-up`);
  await fillPasswordSignupForm(page, input);
  await page.getByRole("button", { name: "온보딩 시작" }).click();
}

async function fillPasswordSigninForm(
  page: Page,
  input: {
    email: string;
    password: string;
  },
) {
  await page.getByLabel("이메일").fill(input.email);
  await page.getByLabel("비밀번호").fill(input.password);
}

async function submitPasswordSignin(
  page: Page,
  baseURL: string,
  input: {
    email: string;
    password: string;
  },
) {
  await page.goto(`${baseURL}/sign-in`);
  await fillPasswordSigninForm(page, input);
  await page.getByRole("button", { name: "대시보드로 이동" }).click();
}

function getRequiredPasswordAuthDatabaseUrl(name: "DATABASE_URL" | "DATABASE_DIRECT_URL") {
  const value = process.env[name] ?? readDotEnvLocalValue(name);

  if (!value) {
    throw new Error(`${name} is required for password auth E2E coverage`);
  }

  return value;
}

function readDotEnvLocalValue(name: string): string | null {
  const envPath = `${process.cwd()}/.env.local`;

  if (!existsSync(envPath)) {
    return null;
  }

  const line = readFileSync(envPath, "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${name}=`));

  if (!line) {
    return null;
  }

  return line
    .slice(name.length + 1)
    .trim()
    .replace(/^"|"$/g, "");
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
        `Password auth server exited early.\n${output.join("").slice(-4000)}`,
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
    `Timed out waiting for password auth server.\n${output.join("").slice(-4000)}`,
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
  test("signs up, logs in, and logs out with production password auth", async ({
    browser,
  }, testInfo) => {
    const passwordServer = await startPasswordAuthServer(3200 + testInfo.workerIndex);
    const unique = `${Date.now()}-${testInfo.workerIndex}`;
    const ipAddress = `password-auth-${unique}`;
    const email = `playwright-password-${unique}@example.com`;
    const password = "Safe-password-2026";
    const context = await browser.newContext({
      extraHTTPHeaders: {
        "x-forwarded-for": ipAddress,
      },
    });

    try {
      await cleanupPasswordAuthAccount(email);
      await cleanupPasswordAuthThrottle(ipAddress, [email]);
      const page = await context.newPage();

      await page.goto(`${passwordServer.baseURL}/sign-up`);
      await expect(page.locator('[data-reference="ypY4e"]')).toBeVisible();
      await fillPasswordSignupForm(page, {
        email,
        name: "비밀번호 테스트",
        tenantName: `Playwright Seller ${unique}`,
        password,
      });
      await page.getByRole("button", { name: "온보딩 시작" }).click();

      await expect(page).toHaveURL(/\/app\/onboarding$/);
      await expect(page.locator('[data-reference="wxMIN"]')).toBeVisible();
      await expect(
        page.getByRole("navigation", { name: "주요 메뉴" }),
      ).toBeVisible();
      await page.goto(`${passwordServer.baseURL}/app`);
      await expect(page.locator('[data-reference="DkLfQ"]')).toBeVisible();

      await page.goto(`${passwordServer.baseURL}/logout`);
      await expect(page).toHaveURL(/\/sign-in$/);
      await page.goto(`${passwordServer.baseURL}/app`);
      await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);

      await expect(page.locator('[data-reference="YA9gq"]')).toBeVisible();
      await expect(
        page.getByRole("heading", { name: "운영 워크스페이스에 로그인" }),
      ).toBeVisible();
      await expect(page.getByLabel("이메일")).toBeVisible();
      await expect(page.getByLabel("비밀번호")).toBeVisible();
      await expect(page.getByRole("button", { name: "대시보드로 이동" })).toBeVisible();
      await expect(page.getByText("현재 인증 설정이 완료되지 않았습니다.")).toHaveCount(0);

      await fillPasswordSigninForm(page, {
        email,
        password: "Wrong-password-2026",
      });
      await page.getByRole("button", { name: "대시보드로 이동" }).click();
      await expect(
        page.getByText("이메일 또는 비밀번호가 올바르지 않습니다."),
      ).toBeVisible();

      await fillPasswordSigninForm(page, {
        email,
        password,
      });
      await page.getByRole("button", { name: "대시보드로 이동" }).click();
      await expect(page).toHaveURL(/\/app$/);
      await expect(page.locator('[data-reference="DkLfQ"]')).toBeVisible();

      await page.goto(`${passwordServer.baseURL}/invite/not-real`);
      await expect(page.getByText("초대 수락은 계정 관리 기능과 함께 열릴 예정입니다.")).toBeVisible();
      await expect(page.getByRole("button", { name: "초대 수락" })).toHaveCount(0);

      await page.goto(`${passwordServer.baseURL}/logout`);
      await page.goto(`${passwordServer.baseURL}/app`);
      await expect(page).toHaveURL(/\/sign-in\?next=%2Fapp$/);
    } finally {
      await context.close();
      await passwordServer.stop();
      await cleanupPasswordAuthAccount(email);
      await cleanupPasswordAuthThrottle(ipAddress, [email]);
    }
  });

  test("limits repeated password signups from one IP before account creation", async ({
    browser,
  }, testInfo) => {
    const passwordServer = await startPasswordAuthServer(3300 + testInfo.workerIndex);
    const unique = `${Date.now()}-${testInfo.workerIndex}`;
    const ipAddress = `signup-limit-${unique}`;
    const emails = Array.from(
      { length: 6 },
      (_, index) => `playwright-limit-${unique}-${index}@example.com`,
    );
    const context = await browser.newContext({
      extraHTTPHeaders: {
        "x-forwarded-for": ipAddress,
      },
    });

    try {
      await cleanupPasswordAuthThrottle(ipAddress, emails);
      await Promise.all(emails.map((email) => cleanupPasswordAuthAccount(email)));
      const page = await context.newPage();

      for (const [index, email] of emails.slice(0, 5).entries()) {
        await submitPasswordSignup(page, passwordServer.baseURL, {
          email,
          name: "가입 제한 테스트",
          tenantName: `Limit Seller ${unique}-${index}`,
          password: "Safe-password-2026",
        });

        await expect(page).toHaveURL(/\/app\/onboarding$/);
        await expect(page.locator('[data-reference="wxMIN"]')).toBeVisible();
        await page.goto(`${passwordServer.baseURL}/logout`);
        await expect(page).toHaveURL(/\/sign-in$/);
      }

      await submitPasswordSignup(page, passwordServer.baseURL, {
        email: emails[5],
        name: "가입 제한 테스트",
        tenantName: `Limit Seller ${unique}-blocked`,
        password: "Safe-password-2026",
      });

      await expect(page).toHaveURL(/\/sign-up\?.*error=rate_limited/);
      await expect(page.locator(".auth-error")).toContainText(
        "요청이 잠시 제한되었습니다.",
      );
      const blockedAccountExists = await passwordAuthAccountExists(emails[5]);
      expect(blockedAccountExists).toBe(false);
    } finally {
      await context.close();
      await passwordServer.stop();
      await Promise.all(emails.map((email) => cleanupPasswordAuthAccount(email)));
      await cleanupPasswordAuthThrottle(ipAddress, emails);
    }
  });

  test("keeps the IP-wide sign-in limit after a successful login", async ({
    browser,
  }, testInfo) => {
    const passwordServer = await startPasswordAuthServer(3400 + testInfo.workerIndex);
    const unique = `${Date.now()}-${testInfo.workerIndex}`;
    const ipAddress = `signin-limit-${unique}`;
    const email = `playwright-signin-limit-${unique}@example.com`;
    const password = "Safe-password-2026";
    const sprayEmails = Array.from(
      { length: 9 },
      (_, index) => `spray-${unique}-${index}@example.com`,
    );
    const context = await browser.newContext({
      extraHTTPHeaders: {
        "x-forwarded-for": ipAddress,
      },
    });

    try {
      await cleanupPasswordAuthThrottle(ipAddress, [email, ...sprayEmails]);
      await cleanupPasswordAuthAccount(email);
      const page = await context.newPage();

      await submitPasswordSignup(page, passwordServer.baseURL, {
        email,
        name: "로그인 제한 테스트",
        tenantName: `Signin Limit Seller ${unique}`,
        password,
      });
      await expect(page).toHaveURL(/\/app\/onboarding$/);
      await page.goto(`${passwordServer.baseURL}/logout`);

      await submitPasswordSignin(page, passwordServer.baseURL, {
        email,
        password,
      });
      await expect(page).toHaveURL(/\/app$/);
      await page.goto(`${passwordServer.baseURL}/logout`);

      for (const sprayEmail of sprayEmails) {
        await submitPasswordSignin(page, passwordServer.baseURL, {
          email: sprayEmail,
          password: "Wrong-password-2026",
        });
        await expect(page.locator(".auth-error")).toContainText(
          "이메일 또는 비밀번호가 올바르지 않습니다.",
        );
      }

      await submitPasswordSignin(page, passwordServer.baseURL, {
        email,
        password,
      });

      await expect(page).toHaveURL(/\/sign-in\?.*error=rate_limited/);
      await expect(page.locator(".auth-error")).toContainText(
        "요청이 잠시 제한되었습니다.",
      );
    } finally {
      await context.close();
      await passwordServer.stop();
      await cleanupPasswordAuthAccount(email);
      await cleanupPasswordAuthThrottle(ipAddress, [email, ...sprayEmails]);
    }
  });

  test("schedules real Coupang sync jobs through password auth storage", async ({
    browser,
  }, testInfo) => {
    const passwordServer = await startPasswordAuthServer(3500 + testInfo.workerIndex);
    const unique = `${Date.now()}-${testInfo.workerIndex}`;
    const ipAddress = `coupang-db-${unique}`;
    const email = `playwright-coupang-db-${unique}@example.com`;
    const password = "Safe-password-2026";
    const context = await browser.newContext({
      extraHTTPHeaders: {
        "x-forwarded-for": ipAddress,
      },
    });

    try {
      await cleanupPasswordAuthThrottle(ipAddress, [email]);
      await cleanupPasswordAuthAccount(email);
      const page = await context.newPage();

      await submitPasswordSignup(page, passwordServer.baseURL, {
        email,
        name: "쿠팡 DB 테스트",
        tenantName: `Coupang DB Seller ${unique}`,
        password,
      });
      await expect(page).toHaveURL(/\/app\/onboarding$/);
      await page.goto(`${passwordServer.baseURL}/app/integrations`);

      const integrations = page.locator('[data-reference="jnl9R"]');
      await integrations.getByLabel("판매자 ID").fill("A00123456");
      await integrations.getByLabel("연동 이름").fill("본점 쿠팡");
      await integrations.getByLabel("Access Key").fill("coupang-access-key");
      await integrations.getByLabel("Secret Key").fill("coupang-secret-key");
      await integrations.getByRole("button", { name: "쿠팡 연결 저장" }).click();

      await expect(integrations.getByRole("status")).toContainText(
        "쿠팡 연동 정보를 안전하게 저장했습니다.",
      );
      await page.reload();
      await expect(integrations.getByText("3개 작업이 대기 중입니다.")).toBeVisible();

      expect(await getCoupangJobsForPasswordAuthAccount(email)).toEqual([
        { type: "coupang.cs.collection.prepare", status: "queued" },
        { type: "coupang.orders.collection.prepare", status: "queued" },
        { type: "coupang.products.collection.prepare", status: "queued" },
      ]);

      await integrations.getByRole("button", { name: "쿠팡 연결 해제" }).click();
      await expect
        .poll(() => getCoupangJobsForPasswordAuthAccount(email))
        .toEqual([
          { type: "coupang.cs.collection.prepare", status: "cancelled" },
          { type: "coupang.orders.collection.prepare", status: "cancelled" },
          { type: "coupang.products.collection.prepare", status: "cancelled" },
        ]);

      await page.reload();
      await expect(integrations.getByText("쿠팡을 연결하면 시작됩니다.")).toBeVisible();
      await expect(integrations.getByText("3개 작업이 대기 중입니다.")).toHaveCount(0);
      expect(await getCoupangJobsForPasswordAuthAccount(email)).toEqual([
        { type: "coupang.cs.collection.prepare", status: "cancelled" },
        { type: "coupang.orders.collection.prepare", status: "cancelled" },
        { type: "coupang.products.collection.prepare", status: "cancelled" },
      ]);
    } finally {
      await context.close();
      await passwordServer.stop();
      await cleanupPasswordAuthAccount(email);
      await cleanupPasswordAuthThrottle(ipAddress, [email]);
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

  test("keeps every designed route responsive and synced with exported pen frames", async ({
    browser,
    page,
  }, testInfo) => {
    const publicRoutes = [
      ["/sign-in", "YA9gq", "운영 워크스페이스에 로그인"],
      ["/sign-up", "ypY4e", "워크스페이스 시작"],
    ] as const;
    const protectedRoutes = [
      ["/app", "DkLfQ", "오늘 처리 대시보드"],
      ["/app/orders", "dhrCg", "주문 목록"],
      ["/app/orders/review", "P3jyw1", "발주 승인 검토"],
      ["/app/orders/approval", "mFQBl", "승인 상세 패널"],
      ["/app/cs", "u347IV", "CS 인박스"],
      ["/app/cs/detail", "LFAF9", "답변 초안 승인"],
      ["/app/claims", "vf3YB", "취소·반품"],
      ["/app/integrations", "jnl9R", "마켓 연동"],
      ["/app/products", "Ro2UR", "상품·재고 모니터링"],
      ["/app/history", "H2Nuw", "작업 이력·알림"],
      ["/app/margins", "KiqBh", "가격·마진 모니터링"],
    ] as const;
    const viewports = [
      { height: 1024, label: "desktop", width: 1440 },
      { height: 1180, label: "tablet", width: 820 },
      { height: 844, label: "mobile", width: 390 },
    ] as const;

    for (const [, referenceId] of [...publicRoutes, ...protectedRoutes]) {
      expectDesignExport(referenceId);
    }
    expectDesignExport("GlQOZ");

    const passwordServer = await startPasswordAuthServer(3500 + testInfo.workerIndex);
    const passwordContext = await browser.newContext();
    const passwordPage = await passwordContext.newPage();

    try {
      for (const viewport of viewports) {
        await passwordPage.setViewportSize({
          height: viewport.height,
          width: viewport.width,
        });

        for (const [url, referenceId, heading] of publicRoutes) {
          await passwordPage.goto(`${passwordServer.baseURL}${url}`);
          await expect(passwordPage.locator(`[data-reference="${referenceId}"]`)).toBeVisible();
          await expect(passwordPage.getByRole("heading", { name: heading })).toBeVisible();
          await expect(passwordPage.getByLabel("비밀번호")).toBeVisible();

          if (referenceId === "YA9gq") {
            await expect(passwordPage.getByLabel("워크스페이스")).toHaveCount(0);
          } else {
            await expect(passwordPage.getByText("Operator")).toHaveCount(0);
            await expect(passwordPage.getByText("소유자")).toHaveCount(0);
          }

          await expectHealthyVisualLayout(passwordPage, `${viewport.label} ${url}`);
        }
      }
    } finally {
      await passwordContext.close();
      await passwordServer.stop();
    }

    await page.setViewportSize({ height: 1024, width: 1440 });
    await signIn(page);
    const primaryButtonColor = await page
      .locator(".ops-primary-button")
      .first()
      .evaluate((element) => getComputedStyle(element).backgroundColor);
    expect(primaryButtonColor).toBe("rgb(15, 118, 110)");

    for (const viewport of viewports) {
      await page.setViewportSize({
        height: viewport.height,
        width: viewport.width,
      });

      for (const [url, referenceId, heading] of protectedRoutes) {
        await page.goto(url);
        const effectiveReferenceId =
          viewport.width <= 520 && referenceId === "DkLfQ" ? "GlQOZ" : referenceId;
        const effectiveHeading =
          viewport.width <= 520 && referenceId === "DkLfQ" ? "오늘 처리" : heading;

        await expect(page.locator(`[data-reference="${effectiveReferenceId}"]`)).toBeVisible();
        await expect(page.getByRole("heading", { name: effectiveHeading })).toBeVisible();
        await expectHealthyVisualLayout(page, `${viewport.label} ${url}`);
      }
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
    await expect(
      integrations.getByRole("heading", { name: "동기화 작업" }),
    ).toBeVisible();
    await expect(integrations.getByText("3개 작업이 대기 중입니다.")).toBeVisible();
    await expect(integrations.getByText("주문 수집", { exact: true })).toBeVisible();
    await expect(integrations.getByText("상품 확인", { exact: true })).toBeVisible();
    await expect(integrations.getByText("문의 확인", { exact: true })).toBeVisible();

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
