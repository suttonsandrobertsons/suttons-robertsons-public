import { test, expect } from "@playwright/test";

// The footer newsletter sign-up must reject invalid email addresses.
// We only exercise the INVALID case: it should be blocked client-side, so no
// real subscription is ever sent from these tests.
const ANY_PAGE = "/dev/forms/gold-calculator"; // footer form is on every page

test.describe("footer newsletter validation", () => {
  test("rejects an invalid email address (no submission)", async ({ page }) => {
    await page.goto(ANY_PAGE);
    const form = page.locator('[data-form="footer-form"], #footer-form').first();
    const email = form.locator('input[name="email"]');
    await email.fill("notanemail");

    // Attempt to submit; an invalid email must not produce the success state.
    await form.locator('[type="submit"]').first().click();

    // The form engine flags the field invalid and the Webflow success block
    // must stay hidden. Assert both signals (either is sufficient proof it
    // was blocked, but we check the success message never appears).
    await expect(form.locator(".w-form-done")).toBeHidden();
    const flaggedInvalid = await email.evaluate(
      (el) =>
        el.getAttribute("aria-invalid") === "true" ||
        /invalid|error/.test(el.getAttribute("data-form-state") || "") ||
        !el.checkValidity()
    );
    expect(flaggedInvalid).toBe(true);
  });

  test("accepts a well-formed email as valid input (no submit)", async ({
    page,
  }) => {
    await page.goto(ANY_PAGE);
    const form = page.locator('[data-form="footer-form"], #footer-form').first();
    const email = form.locator('input[name="email"]');
    await email.fill("valid.person@example.com");
    // Do NOT submit (would subscribe a real address). Just assert the value is
    // accepted as structurally valid client-side.
    const valid = await email.evaluate((el) => el.checkValidity());
    expect(valid).toBe(true);
  });
});
