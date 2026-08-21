import { test, expect } from "@playwright/test";

// The /dev/forms/ page is a single-item calculator harness (no add-item,
// upload, or continue nav), so multi-item, upload and step behaviour is not
// covered here — those need the full multi-step form page.
const GOLD_CALC = "/dev/forms/gold-calculator";

async function setRadioByValue(page, scopeSelector, value) {
  await page.evaluate(
    ({ scopeSelector, value }) => {
      const scope = document.querySelector(scopeSelector);
      const r = [...scope.querySelectorAll('input[type="radio"]')].find(
        (x) => x.value === value
      );
      if (!r) throw new Error(`radio value="${value}" not in ${scopeSelector}`);
      r.checked = true;
      ["input", "change", "click"].forEach((t) =>
        r.dispatchEvent(new Event(t, { bubbles: true }))
      );
    },
    { scopeSelector, value }
  );
}

async function fillJewellery(page, { carat, weight, qty }) {
  await page.evaluate(
    ({ carat, weight, qty }) => {
      const gf = document.querySelector('[data-form="gold"]');
      const fire = (el) =>
        ["input", "change"].forEach((t) =>
          el.dispatchEvent(new Event(t, { bubbles: true }))
        );
      const setVal = (el, v) => {
        const proto =
          el.tagName === "SELECT"
            ? HTMLSelectElement.prototype
            : HTMLInputElement.prototype;
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
        fire(el);
      };
      setVal(gf.querySelector('[name="gold_metal_type_1"]'), carat);
      setVal(gf.querySelector('[name="gold_weight_grams_1"]'), weight);
      const q = gf.querySelector('[name="gold_quantity_1"]');
      if (q) setVal(q, qty);
    },
    { carat, weight, qty }
  );
}

async function fillJewelleryItem(page, enquiry, opts) {
  await setRadioByValue(page, '[data-form="gold"]', enquiry);
  await setRadioByValue(page, "[data-form-gold-item]", "jewellery");
  await expect(
    page.locator('[data-form-gold-item] [data-form-field="metal_type"]').first()
  ).toBeVisible();
  await fillJewellery(page, opts);
}

function readEmit(page) {
  return page.evaluate(() => {
    const gf = document.querySelector('[data-form="gold"]');
    const fd = Object.fromEntries(new FormData(gf).entries());
    return fd;
  });
}

async function pollForTotal(page, field) {
  await expect
    .poll(async () => (await readEmit(page))[field], { timeout: 15_000 })
    .toMatch(/^[1-9]\d*$/);
}

test.describe("gold calculator (live)", () => {
  test("condition rules toggle field visibility (carat vs bullion)", async ({
    page,
  }) => {
    await page.goto(GOLD_CALC);
    const item = page.locator("[data-form-gold-item]").first();
    const carat = item.locator('[data-form-field="metal_type"]');
    const bullion = item.locator('[data-form-field="bullion_name"]').first();

    await expect(carat).toBeHidden();
    await expect(bullion).toBeHidden();

    await setRadioByValue(page, "[data-form-gold-item]", "jewellery");
    await expect(carat).toBeVisible();
    await expect(bullion).toBeHidden();

    await setRadioByValue(page, "[data-form-gold-item]", "coin");
    await expect(bullion).toBeVisible();
    await expect(carat).toBeHidden();
  });

  // "Other" is removed as an unsupported carat: it had no pricing row, so
  // selecting it blocked Continue.
  test('carat select no longer offers "Other"', async ({ page }) => {
    await page.goto(GOLD_CALC);
    await setRadioByValue(page, "[data-form-gold-item]", "jewellery");
    const carat = page.locator('[name="gold_metal_type_1"]');
    await expect(carat).toBeVisible();
    const values = await carat
      .locator("option")
      .evaluateAll((os) => os.map((o) => o.value));
    expect(values).not.toContain("Other");
    expect(values).toEqual(expect.arrayContaining(["9", "14", "18", "22", "24"]));
  });

  test("loan estimate emits whole-£ amounts, per-item amount, asset type", async ({
    page,
  }) => {
    await page.goto(GOLD_CALC);
    await fillJewelleryItem(page, "Loan", { carat: "18", weight: "15", qty: "1" });
    await pollForTotal(page, "gold_loan_total");

    const e = await readEmit(page);
    expect(e.gold_purchase_total).toMatch(/^\d+$/);
    expect(e.gold_loan_total).toMatch(/^\d+$/);
    expect(e.gold_total).toMatch(/^\d+$/);
    expect(e.gold_item_1_asset_type).toBe("Gold");
    expect(e.gold_item_1_amount).toBe(e.gold_loan_total);
    expect(e.gold_item_1_type).toBe("Jewellery"); // Zoho picklist case
    expect(e.gold_interest_rate).toMatch(/^\d+\.\d$/);
  });

  test("sell enquiry flips amounts to purchase and shows the estimate row", async ({
    page,
  }) => {
    await page.goto(GOLD_CALC);
    await fillJewelleryItem(page, "Sell My Items", {
      carat: "18",
      weight: "15",
      qty: "1",
    });
    await pollForTotal(page, "gold_purchase_total");

    const e = await readEmit(page);
    expect(e.gold_total).toBe(e.gold_purchase_total);
    expect(e.gold_item_1_amount).toBe(e.gold_purchase_total);
    await expect(page.locator(".form-gold_estimate-row").first()).toBeVisible();
  });

  // Pricing intent: 2% spot discount before the 88% purchase / 75% loan ratios.
  // Asserts a band (rounding-tolerant) that rejects the ratios reverting
  // (e.g. discount removed → purchase/spot 0.88, or LTV back to 70% → 0.69).
  test("purchase/loan sit at the discounted ratios vs raw spot", async ({
    page,
  }) => {
    await page.goto(GOLD_CALC);
    await fillJewelleryItem(page, "Loan", { carat: "18", weight: "20", qty: "1" });
    await pollForTotal(page, "gold_loan_total");

    const e = await readEmit(page);
    const spot = Number(e.gold_item_1_spot_value);
    const purchaseRatio = Number(e.gold_item_1_purchase_value) / spot;
    const loanRatio = Number(e.gold_item_1_loan_value) / spot;
    expect(purchaseRatio).toBeGreaterThan(0.85); // ~0.86 (0.98 × 0.88)
    expect(purchaseRatio).toBeLessThan(0.875); // rejects 0.88 (no discount)
    expect(loanRatio).toBeGreaterThan(0.72); // ~0.74 (0.98 × 0.75)
    expect(loanRatio).toBeLessThan(0.745); // rejects 0.75 (no discount)
  });

  // Empty item slots emit blank amount/asset type — no phantom Zoho line items.
  test("unused item slots emit blank amount and asset type", async ({
    page,
  }) => {
    await page.goto(GOLD_CALC);
    await fillJewelleryItem(page, "Loan", { carat: "18", weight: "15", qty: "1" });
    await pollForTotal(page, "gold_loan_total");

    const e = await readEmit(page);
    for (const i of [2, 3, 4, 5]) {
      expect(e[`gold_item_${i}_amount`]).toBe("");
      expect(e[`gold_item_${i}_asset_type`]).toBe("");
    }
  });

  async function fillCoin(page, enquiry, bullion) {
    await setRadioByValue(page, '[data-form="gold"]', enquiry);
    await setRadioByValue(page, "[data-form-gold-item]", "coin");
    await page.evaluate((bullion) => {
      const gf = document.querySelector('[data-form="gold"]');
      const fire = (el) =>
        ["input", "change"].forEach((t) =>
          el.dispatchEvent(new Event(t, { bubbles: true }))
        );
      const setVal = (el, proto, v) => {
        Object.getOwnPropertyDescriptor(proto, "value").set.call(el, v);
        fire(el);
      };
      // The active bullion select is the visible one inside the bullion field
      // (the field-group logic hides/renames the others), so target by
      // visibility rather than a fixed name.
      const sel = [...gf.querySelectorAll('[data-form-field="bullion_name"] select')].find(
        (s) => s.offsetParent !== null
      );
      setVal(sel, HTMLSelectElement.prototype, bullion);
      const q = gf.querySelector('[name="gold_quantity_1"]');
      if (q) setVal(q, HTMLInputElement.prototype, "1");
    }, bullion);
  }

  // Swiss/French Francs and Gold American Eagles
  // carry a further 6% trim on the 88% purchase / 75% loan offers, set per
  // pricing row in CMS (extra-discount). Effective ratios vs raw spot:
  // purchase ≈ 0.98×0.88×0.94 = 0.810, loan ≈ 0.98×0.75×0.94 = 0.691.
  test("coin-group discount trims Francs/Eagles ~6% below the standard ratios", async ({
    page,
  }) => {
    await page.goto(GOLD_CALC);
    await fillCoin(page, "Loan", "1_oz_gold_american_eagle");
    await pollForTotal(page, "gold_loan_total");

    const e = await readEmit(page);
    const spot = Number(e.gold_item_1_spot_value);
    expect(Number(e.gold_item_1_purchase_value) / spot).toBeGreaterThan(0.79);
    expect(Number(e.gold_item_1_purchase_value) / spot).toBeLessThan(0.825); // rejects 0.86 (undiscounted)
    expect(Number(e.gold_item_1_loan_value) / spot).toBeGreaterThan(0.675);
    expect(Number(e.gold_item_1_loan_value) / spot).toBeLessThan(0.705); // rejects 0.74 (undiscounted)
  });

  // Control: a non-flagged coin (Sovereign) stays at the standard discounted
  // ratios — proving the trim is targeted, not global.
  test("a non-flagged coin (Sovereign) keeps the standard ratios", async ({
    page,
  }) => {
    await page.goto(GOLD_CALC);
    await fillCoin(page, "Loan", "gold_sovereign");
    await pollForTotal(page, "gold_loan_total");

    const e = await readEmit(page);
    const spot = Number(e.gold_item_1_spot_value);
    expect(Number(e.gold_item_1_purchase_value) / spot).toBeGreaterThan(0.85); // ~0.86
    expect(Number(e.gold_item_1_purchase_value) / spot).toBeLessThan(0.875);
    expect(Number(e.gold_item_1_loan_value) / spot).toBeGreaterThan(0.72); // ~0.74
    expect(Number(e.gold_item_1_loan_value) / spot).toBeLessThan(0.745);
  });
});
