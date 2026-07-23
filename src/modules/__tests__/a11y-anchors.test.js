import { describe, it, expect, beforeEach } from "vitest";
import { initA11yAnchors } from "../a11y-anchors.js";

describe("initA11yAnchors", () => {
  beforeEach(() => { document.body.innerHTML = ""; });

  it("labels a path anchor from its href", () => {
    document.body.innerHTML = `<a href="/pawnbroking" class="u-cover u-opacity-000"></a>`;
    initA11yAnchors();
    expect(document.querySelector("a").getAttribute("aria-label")).toBe("Pawnbroking");
  });

  it("labels tel:, logo, google and trustpilot links sensibly", () => {
    document.body.innerHTML = `
      <a href="tel:08001822335" class="rulertel u-cover"></a>
      <a href="/" class="footer_logo"></a>
      <a href="#" class="footer_google"></a>
      <a href="https://www.trustpilot.com/review/x" class="u-cover"></a>`;
    initA11yAnchors();
    const [tel, logo, google, tp] = [...document.querySelectorAll("a")];
    expect(tel.getAttribute("aria-label")).toBe("Call us");
    expect(logo.getAttribute("aria-label")).toBe("Suttons & Robertsons — home");
    expect(google.getAttribute("aria-label")).toBe("Google reviews");
    expect(tp.getAttribute("aria-label")).toBe("Trustpilot reviews");
  });

  it("falls back to a nearby heading for href='#' links with no other signal", () => {
    document.body.innerHTML = `<div class="card"><h3>Rolex Watches</h3><a href="#" class="u-cover"></a></div>`;
    initA11yAnchors();
    expect(document.querySelector("a").getAttribute("aria-label")).toBe("Rolex Watches");
  });

  it("never overwrites an existing accessible name", () => {
    document.body.innerHTML = `
      <a href="/x" aria-label="Keep me">x</a>
      <a href="/y">Has text</a>
      <a href="/z"><img alt="Logo"></a>`;
    initA11yAnchors();
    const [a, b, c] = [...document.querySelectorAll("a")];
    expect(a.getAttribute("aria-label")).toBe("Keep me");
    expect(b.hasAttribute("aria-label")).toBe(false);
    expect(c.hasAttribute("aria-label")).toBe(false);
  });

  it("is idempotent and returns the count labelled", () => {
    document.body.innerHTML = `<a href="/gold-loans" class="u-cover"></a>`;
    expect(initA11yAnchors()).toBe(1);
    expect(initA11yAnchors()).toBe(0); // already processed
  });
});
