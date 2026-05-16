import { expect, test } from "@playwright/test";

test.describe("production smoke", () => {
  test.skip(
    !process.env.E2E_PROD_BASE_URL || !process.env.E2E_PROD_OPERATOR_KEY,
    "Set E2E_PROD_BASE_URL and E2E_PROD_OPERATOR_KEY to smoke-test a deployed service.",
  );

  test("checks the deployed auth shell and protected operator health", async ({
    page,
    request,
  }) => {
    const baseURL = process.env.E2E_PROD_BASE_URL!;
    const operatorKey = process.env.E2E_PROD_OPERATOR_KEY!;

    await page.goto(`${baseURL}/sign-in`);
    await expect(
      page.getByRole("heading", { name: "운영 워크스페이스에 로그인" }),
    ).toBeVisible();
    await expect(page.getByLabel("이메일")).toBeVisible();

    const health = await request.get(`${baseURL}/api/admin/health`, {
      headers: {
        authorization: `Bearer ${operatorKey}`,
      },
    });
    expect(health.status()).toBeLessThan(500);

    const payload = (await health.json()) as {
      checks?: { name?: string; status?: string }[];
      ok?: boolean;
    };
    expect(payload).toHaveProperty("ok");
    expect(payload.checks?.map((check) => check.name)).toEqual([
      "환경 변수",
      "데이터베이스",
      "작업 큐",
    ]);
    expect(JSON.stringify(payload)).not.toContain(operatorKey);
  });
});
