import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("database migrations", () => {
  it("removes the legacy global integration provider unique index before adding tenant uniqueness", async () => {
    const migration = await readFile(
      new URL("./migrations/0002_wild_stardust.sql", import.meta.url),
      "utf8",
    );
    const dropLegacyIndex = migration.indexOf(
      'DROP INDEX "integration_provider_unique"',
    );
    const createTenantIndex = migration.indexOf(
      'CREATE UNIQUE INDEX "integration_tenant_provider_unique"',
    );

    expect(dropLegacyIndex).toBeGreaterThanOrEqual(0);
    expect(createTenantIndex).toBeGreaterThanOrEqual(0);
    expect(dropLegacyIndex).toBeLessThan(createTenantIndex);
  });
});
