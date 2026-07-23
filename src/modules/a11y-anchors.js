/**
 * Accessible-name sweep for anchors (SR-420).
 *
 * Semrush flags ~thousands of links with "no anchor text" — almost all are
 * decorative/overlay links Webflow generates with no visible text and no
 * aria-label: mega-nav column + feature overlays, `.rulertel` click-to-call
 * covers, logo links, footer badges, and card/image cover links across CMS
 * pages. Hand-labelling every component in the Designer is impractical at that
 * scale, so this gives every nameless <a> a sensible `aria-label` at runtime.
 *
 * It only touches anchors that have NO accessible name (no text, aria-label,
 * title, aria-labelledby, or a labelled child/image) — anything already named
 * is left untouched, so hand-written labels always win. Idempotent.
 */

const PROCESSED = "data-a11y-anchor";

function hasAccessibleName(a) {
  if ((a.textContent || "").trim()) return true;
  const label = a.getAttribute("aria-label");
  if (label && label.trim()) return true;
  const title = a.getAttribute("title");
  if (title && title.trim()) return true;
  if (a.getAttribute("aria-labelledby")) return true;
  const img = a.querySelector("img[alt]");
  if (img && (img.getAttribute("alt") || "").trim()) return true;
  if (a.querySelector("[aria-label]")) return true;
  return false;
}

function humanizeHref(href) {
  if (!href || href === "#") return "";
  if (href.startsWith("tel:")) return "Call us";
  if (href.startsWith("mailto:")) return "Email us";
  try {
    const url = new URL(href, window.location.origin);
    if (!url.pathname || url.pathname === "/") return "";
    const seg = url.pathname.split("/").filter(Boolean).pop() || "";
    return seg.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return "";
  }
}

// Nearest heading/title text within the link's own card/container — best-quality
// label for card and feature overlays. Climbs a few levels only, to avoid
// grabbing a far-away section heading.
function nearestText(a) {
  let el = a;
  for (let i = 0; i < 3 && el; i++) {
    const h = el.querySelector && el.querySelector("h1,h2,h3,h4,h5,h6,[class*='heading'],[class*='title']");
    const text = h && (h.textContent || "").trim();
    if (text) return text.slice(0, 80);
    el = el.parentElement;
  }
  return "";
}

function deriveLabel(a) {
  const href = (a.getAttribute("href") || "").trim();
  const cls = (a.getAttribute("class") || "").toLowerCase();

  // Known badges / logos first — most specific.
  if (/logo/.test(cls)) return "Suttons & Robertsons — home";
  if (/google/.test(cls)) return "Google reviews";
  if (/trustpilot/.test(cls) || /trustpilot/i.test(href)) return "Trustpilot reviews";
  if (href.startsWith("tel:")) return "Call us";
  if (href.startsWith("mailto:")) return "Email us";

  // A real destination path gives a specific, per-link label
  // (e.g. /pawnbroking -> "Pawnbroking"). Preferred over a shared container heading.
  const fromHref = humanizeHref(href);
  if (fromHref) return fromHref;

  // Fallbacks for href="#" / JS-driven links.
  const ctx = nearestText(a);
  if (ctx) return ctx;
  if ((href === "/" || href === "") && /logo|home/.test(cls)) return "Suttons & Robertsons — home";
  return "Suttons & Robertsons";
}

export function initA11yAnchors(scope = document) {
  if (typeof document === "undefined") return 0;
  let labelled = 0;
  const root = scope && scope.querySelectorAll ? scope : document;
  root.querySelectorAll("a").forEach((a) => {
    if (a.hasAttribute(PROCESSED)) return;
    if (hasAccessibleName(a)) return;
    const label = deriveLabel(a);
    if (!label) return;
    a.setAttribute("aria-label", label);
    a.setAttribute(PROCESSED, "");
    labelled += 1;
  });
  return labelled;
}
