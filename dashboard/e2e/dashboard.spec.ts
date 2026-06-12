// =============================================================================
// Tier 2 — the full authenticated journey, one ordered story against the real
// stack (local Next build + live Supabase + live proxy). Skipped automatically
// when admin credentials are absent (e.g. public CI).
//
// Journey: fresh user -> onboarding -> connection -> project -> attach ->
// mint key -> real proxied test call -> budget 402 -> rotate -> revoke.
// =============================================================================
import { expect, test } from "@playwright/test";
import {
  createSignedInUser,
  deleteTestUser,
  sessionCookies,
  tier2Available,
  type TestUser,
} from "./supabase-helpers";

test.describe("authenticated journey", () => {
  test.describe.configure({ mode: "serial" });
  test.skip(!tier2Available(), "needs SUPABASE_SERVICE_ROLE_KEY (local only)");
  // One browser is enough for the journey; skip the mobile project here.
  test.skip(
    () => test.info().project.name === "mobile",
    "journey runs on desktop only",
  );

  let user: TestUser;
  let mintedKey = "";

  test.beforeAll(async () => {
    user = await createSignedInUser();
  });

  test.afterAll(async () => {
    if (user) await deleteTestUser(user.id); // cascades all created rows
  });

  test.beforeEach(async ({ context }) => {
    await context.addCookies(sessionCookies(user.session));
  });

  test("fresh account lands on onboarding", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText("Get started")).toBeVisible();
    await expect(page.getByText("Add a connection")).toBeVisible();
  });

  test("create a no-auth connection (the mobile-bug regression)", async ({ page }) => {
    await page.goto("/dashboard");
    // Custom provider, no auth header, blank cost — exactly the combination
    // that failed on mobile before the optional-header fix.
    await page.getByRole("textbox", { name: "Connection name" }).fill("GitHub");
    await page.getByRole("textbox", { name: "Base URL" }).fill("https://api.github.com");
    await page.getByRole("button", { name: "Add connection" }).click();
    // Strong post-condition: step 2's form only renders once step 1 committed.
    await expect(
      page.getByPlaceholder("Project name (e.g. My SaaS)"),
    ).toBeVisible({ timeout: 15_000 });
  });

  test("create a project and attach the connection", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByPlaceholder("Project name (e.g. My SaaS)").fill("E2E");
    await page.getByRole("button", { name: "Create project" }).click();

    const picker = page.getByLabel("Connection to attach");
    await expect(picker).toBeVisible({ timeout: 15_000 });
    await picker.selectOption({ label: "GitHub" });
    // Slug auto-fills from the connection name.
    await expect(page.getByPlaceholder("slug")).toHaveValue("github");
    await page.getByRole("button", { name: "Attach" }).click();
    // Strong post-condition: the mint button only renders once the attach
    // has committed and step 3 became active (titles alone are always shown).
    await expect(page.getByRole("button", { name: "New key" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("mint a key and make a real proxied call", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "New key" }).click();

    // Exactly a freshly minted key — not the docs curl example, which also
    // contains the literal "alw_live_YOUR_KEY".
    const keyBox = page.locator("code", { hasText: /^alw_live_[A-Za-z0-9_-]{20,}$/ });
    await expect(keyBox).toBeVisible({ timeout: 30_000 });
    mintedKey = (await keyBox.textContent())?.trim() ?? "";
    expect(mintedKey).toMatch(/^alw_live_/);

    // Give the account a budget so the call clears the hard cap.
    await page.getByPlaceholder(/Set budget/).fill("5");
    await page.getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByText(/Budget set to \$5\.00/)).toBeVisible({
      timeout: 15_000,
    });

    // One real call through the live proxy to api.github.com. (p[role=status]
    // is the verdict line; toasts also carry role=status.)
    await page.getByRole("button", { name: "Test it" }).click();
    await expect(page.locator("p[role=status]")).toContainText(/✓/, {
      timeout: 30_000,
    });
  });

  test("the key can inspect itself via /v1/me", async ({ request }) => {
    const res = await request.get("https://api.getallowance.dev/v1/me", {
      headers: { Authorization: `Bearer ${mintedKey}` },
    });
    expect(res.status()).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("budgetRemaining");
    expect(body).toHaveProperty("plan", "free");
  });

  test("budget zero hard-stops with 402 at the proxy", async ({ page, request }) => {
    test.setTimeout(150_000); // the edge snapshot may take up to 60s to expire
    await page.goto("/dashboard");
    await page.getByPlaceholder(/Set budget/).fill("0");
    await page.getByRole("button", { name: "Set", exact: true }).click();
    await expect(page.getByText(/Budget set to \$0\.00/)).toBeVisible({ timeout: 15_000 });

    // The edge cache may hold the old balance for up to 60s; poll until 402.
    await expect
      .poll(
        async () => {
          const res = await request.get(
            "https://api.getallowance.dev/v1/proxy/github/users/octocat",
            { headers: { Authorization: `Bearer ${mintedKey}` } },
          );
          return res.status();
        },
        { timeout: 90_000, intervals: [5_000] },
      )
      .toBe(402);
  });

  test("rotate then revoke", async ({ page }) => {
    await page.goto("/dashboard");
    await page.getByRole("button", { name: "Rotate" }).first().click();
    await expect(page.getByText(/New key\. Copy it now/)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("(expiring)")).toBeVisible();

    // Revoke every active key; Remove buttons appear for revoked ones.
    const revoke = page.getByRole("button", { name: "Revoke" });
    while ((await revoke.count()) > 0) {
      await revoke.first().click();
      await expect(page.getByText(/Key revoked/)).toBeVisible({ timeout: 15_000 });
      await page.waitForTimeout(500);
    }
    await expect(page.getByRole("button", { name: "Remove" }).first()).toBeVisible();
  });
});
