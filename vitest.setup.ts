import { execSync } from "node:child_process";
import { existsSync, unlinkSync } from "node:fs";
import { beforeAll, vi } from "vitest";

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

const TEST_DB_PATH = "prisma/test.db";

beforeAll(() => {
  if (existsSync(TEST_DB_PATH)) unlinkSync(TEST_DB_PATH);
  execSync("pnpm exec prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: "file:./prisma/test.db" },
    stdio: "inherit",
  });
});
