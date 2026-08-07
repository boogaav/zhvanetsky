import { expect, test } from "@playwright/test";

const THOUGHT =
  "I bought a smart kettle to save time and spent the weekend updating its firmware. The old kettle just boiled.";

async function generate(page: import("@playwright/test").Page, text = THOUGHT) {
  await page.getByPlaceholder(/messy, emotional/).fill(text);
  await page.getByRole("button", { name: "Find the contradiction" }).click();
  await expect(page.getByTestId("result-text")).toBeVisible({ timeout: 20_000 });
}

test("user enters text and generates a result", async ({ page }) => {
  await page.goto("/");
  await generate(page);
  const result = await page.getByTestId("result-text").innerText();
  expect(result.trim().length).toBeGreaterThan(0);
  // default length: 3-8 lines
  const lines = result.split("\n").filter((l) => l.trim().length > 0);
  expect(lines.length).toBeGreaterThanOrEqual(3);
  expect(lines.length).toBeLessThanOrEqual(8);
  // demo provider is honestly labeled
  await expect(page.getByText(/Demo mode/)).toBeVisible();
});

test("generate works with Ctrl/Cmd+Enter", async ({ page }) => {
  await page.goto("/");
  await page.getByPlaceholder(/messy, emotional/).fill(THOUGHT);
  await page.getByPlaceholder(/messy, emotional/).press("ControlOrMeta+Enter");
  await expect(page.getByTestId("result-text")).toBeVisible({ timeout: 20_000 });
});

test("user copies the result", async ({ page }) => {
  await page.goto("/");
  await generate(page);
  await page.getByRole("button", { name: "Copy", exact: true }).click();
  await expect(page.getByRole("button", { name: "Copied." })).toBeVisible();
});

test("user applies Shorter and the text gets shorter", async ({ page }) => {
  await page.goto("/");
  await generate(page);
  const before = await page.getByTestId("result-text").innerText();
  await page.getByRole("button", { name: "Shorter", exact: true }).click();
  await expect(page.getByTestId("result-text")).not.toHaveText(before, {
    timeout: 20_000,
  });
  const after = await page.getByTestId("result-text").innerText();
  expect(after.length).toBeLessThan(before.length);
});

test("user opens an alternative and can promote it", async ({ page }) => {
  await page.goto("/");
  await generate(page);
  await page.getByText("Two other versions").click();
  await expect(page.getByTestId("alternative-sharper")).toBeVisible();
  await expect(page.getByTestId("alternative-stranger")).toBeVisible();
  const altText = await page
    .getByTestId("alternative-sharper")
    .locator("p")
    .nth(1)
    .innerText();
  await page
    .getByTestId("alternative-sharper")
    .getByRole("button", { name: "Use this one" })
    .click();
  await expect(page.getByTestId("result-text")).toHaveText(altText);
});

test("user changes the output language to Russian", async ({ page }) => {
  await page.goto("/");
  await page.getByText("Tune the voice").click();
  await page.getByRole("radio", { name: "Русский" }).click();
  await generate(page);
  const result = await page.getByTestId("result-text").innerText();
  expect(result).toMatch(/[а-яА-Я]/);
});

test("history persists across reload and can be cleared", async ({ page }) => {
  await page.goto("/");
  await generate(page);
  await page.reload();
  await page.getByText(/Recent thoughts/).click();
  await expect(page.getByText(THOUGHT).first()).toBeVisible();
  await page.getByRole("button", { name: "Clear history" }).click();
  await expect(page.getByText(/Recent thoughts/)).toHaveCount(0);
});

test("API failure produces a readable retry state", async ({ page }) => {
  await page.route("**/api/generate", (route) =>
    route.fulfill({
      status: 502,
      contentType: "application/json",
      body: JSON.stringify({
        error: "provider_unavailable",
        message: "The thought survived. The model didn't. Try once more.",
      }),
    })
  );
  await page.goto("/");
  await page.getByPlaceholder(/messy, emotional/).fill(THOUGHT);
  await page.getByRole("button", { name: "Find the contradiction" }).click();
  await expect(page.getByTestId("error-state")).toBeVisible();
  await expect(
    page
      .getByTestId("error-state")
      .getByText("The thought survived. The model didn't. Try once more.")
  ).toBeVisible();
  // Retry succeeds once the API recovers.
  await page.unroute("**/api/generate");
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("result-text")).toBeVisible({ timeout: 20_000 });
});

test("empty input cannot be submitted", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Find the contradiction" })
  ).toBeDisabled();
});

test("opt-in feedback sends an anonymous learning signal", async ({ page }) => {
  await page.goto("/");
  await generate(page);
  // Off by default: rating must NOT call the API.
  let called = 0;
  await page.route("**/api/feedback", (route) => {
    called++;
    return route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ accepted: true }),
    });
  });
  await page.getByRole("button", { name: "Good result" }).click();
  expect(called).toBe(0);
  // Opt in, rate again: exactly one signal, carrying only the result.
  await page.getByText(/Share anonymous ratings/).click();
  const requestPromise = page.waitForRequest("**/api/feedback");
  await page.getByRole("button", { name: "Bad result" }).click();
  const request = await requestPromise;
  const payload = request.postDataJSON() as Record<string, unknown>;
  expect(payload.kind).toBe("thumbs_down");
  expect(String(payload.result).length).toBeGreaterThan(0);
  expect(payload).not.toHaveProperty("input");
});

test("layout has no horizontal scrolling", async ({ page }) => {
  await page.goto("/");
  await generate(page);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth
  );
  expect(overflow).toBeLessThanOrEqual(0);
  await expect(
    page.getByText("Independent AI writing experiment", { exact: false })
  ).toBeVisible();
});
