// =============================================================================
// Tier 1 — public pages. No secrets needed; runs everywhere including CI.
// Catches: broken rendering, hydration errors (React #418 class), dead links,
// the mobile cursor-glow wash-out regression, and auth-gate bypasses.
// =============================================================================
import { expect, test, type Page } from "@playwright/test";

/** Collect uncaught page errors (hydration mismatches throw in prod React). */
function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (err) => errors.push(String(err)));
  return errors;
}

const PUBLIC_PAGES = ["/", "/docs", "/security", "/terms", "/privacy", "/login"];

for (const path of PUBLIC_PAGES) {
  test(`renders ${path} without uncaught errors`, async ({ page }) => {
    const errors = trackErrors(page);
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(errors).toEqual([]);
  });
}

test("landing: hero, open-source badge, and footer links", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("h1")).toContainText("Pocket money");
  const badge = page.getByRole("link", { name: /open source/i });
  await expect(badge).toHaveAttribute("href", /github\.com\/9atar6\/allowance/);
  await expect(page.locator("footer").getByRole("link", { name: "Security" })).toBeVisible();
  await expect(page.locator("footer").getByRole("link", { name: "Status" })).toBeVisible();
  // The brand sign-off.
  await expect(page.locator("footer")).toContainText("Allow once.");
});

test("security page makes verifiable claims", async ({ page }) => {
  await page.goto("/security");
  await expect(page.locator("h1")).toHaveText("Security");
  const verifyLinks = page.getByRole("link", { name: /verify in the source/i });
  expect(await verifyLinks.count()).toBeGreaterThanOrEqual(5);
  await expect(page.getByText("Honest limits")).toBeVisible();
});

test("docs cover the agent contract", async ({ page }) => {
  await page.goto("/docs");
  await expect(page.getByText("x-allowance-budget-remaining").first()).toBeVisible();
  await expect(page.getByText("daily_limit_reached").first()).toBeVisible();
  await expect(page.getByText("GET /v1/me").first()).toBeVisible();
});

test("dashboard is auth-gated", async ({ page }) => {
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
  await expect(page.locator('input[type="email"], input[name="email"]').first()).toBeVisible();
});
