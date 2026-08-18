---
name: site-performance-audit
description: Run repeatable mobile lab-performance and Core Web Vitals diagnostics with the Chrome DevTools MCP. Use when asked to audit site speed, page-load performance, Core Web Vitals, LCP, CLS, FCP, TBT, render-blocking resources, long tasks, third-party impact, caching, compression, or perceived loading for one URL or a representative set of site pages.
---

# Site Performance Audit

Run a read-only, evidence-based performance audit with Chrome DevTools MCP. Keep test conditions consistent and distinguish measured lab data from field data and inference.

## Establish scope

- Require at least one target URL.
- Describe one URL as a **page audit**, not a full-site audit.
- For a site audit, use user-supplied representative URLs. If only a root URL is supplied, identify a small representative sample of page templates and disclose that sampling; do not imply exhaustive coverage.
- Do not submit forms, change account data, make purchases, or trigger transactional actions.
- Confirm the Chrome DevTools MCP performance, network, evaluation, emulation, navigation, and screenshot tools are callable. If they are unavailable, stop and explain the missing prerequisite.

## Use consistent defaults

Unless the user specifies otherwise, use:

- Three runs per URL and report medians.
- A fresh isolated browser context for every run.
- Viewport: `390x844x3,mobile,touch`.
- CPU throttling: `4`.
- Network conditions: `Fast 3G`.
- A cold navigation from `about:blank` so the measured load does not reuse a prior page cache.

Report the exact conditions. Do not compare results gathered under different conditions as though they were equivalent.

## Measure each URL

For each run:

1. Open `about:blank` with `new_page` in a uniquely named isolated context.
2. Apply the viewport, CPU, and network settings with `emulate` before navigating.
3. Start a trace with `performance_start_trace` using `autoStop: false` and `reload: false`.
4. Navigate to the target URL with `navigate_page`.
5. Allow post-load activity to settle long enough to capture deferred work.
6. Stop the trace with `performance_stop_trace`.
7. Record the available FCP, LCP, TBT, and CLS values. Record run failures instead of silently discarding them.
8. Close the page after collecting the required evidence.

Treat FCP, LCP, TBT, and CLS as lab measurements. TBT is a lab diagnostic and a proxy for responsiveness, not a Core Web Vital. Do not report INP without a representative interaction sequence, and never label these results as real-user or CrUX data unless a separate field-data source establishes that.

## Analyze trace insights

Use the `insightSetId` returned by the trace. Analyze these insights only when the trace lists them as available:

- `LCPBreakdown`
- `RenderBlocking`
- `ThirdParties`
- `ForcedReflow`
- `FontDisplay`

If an insight is absent, state that it was unavailable. Never invent an insight name, identifier, timing, or attribution.

Extract the LCP subparts when present:

- Time to first byte
- Resource load delay
- Resource load duration
- Element render delay

## Inspect network activity

On the final run for each URL:

1. Use `list_network_requests` and paginate until all material requests are covered.
2. Use `get_network_request` for the document and likely bottlenecks rather than fetching every response body.
3. Inspect request timing and response headers for:
   - Render-blocking stylesheets and scripts
   - Oversized images, fonts, scripts, and stylesheets
   - Missing or ineffective content compression
   - Missing, unusually short, or ineffective cache lifetimes
   - Duplicate requests
   - Heavy third-party tags such as consent tools, GTM, analytics, chat, and QA widgets

Support compression and caching claims with response headers. Do not infer them from file extensions alone.

## Inspect runtime activity

Use `evaluate_script` with buffered `PerformanceObserver` entries where supported.

- Return a JSON-serializable description of the final LCP entry and element: timing, tag, stable selector or identifying attributes, dimensions, image URL, and a short text sample. Do not return a DOM node.
- Return long tasks over 50 ms with start time, duration, and serialized attribution fields where available.
- Correlate runtime evidence with trace insights before naming a script as a bottleneck.
- Report attributable main-thread or blocking duration. Do not call it "wasted time" unless unused-code evidence directly supports that claim.

## Capture visual evidence

Use `take_screenshot` with `fullPage: false` on the final run. Inspect the final mobile viewport for the LCP element, placeholders, late content, cookie banners, layout shifts, and visually blocking overlays.

Describe this as the final above-the-fold state. A post-load screenshot is not a loading filmstrip; do not claim that it proves intermediate perceived-loading behavior.

## Report results

Keep the report concise and include:

1. Scope, tested URLs, run count, conditions, failures, and limitations.
2. A median lab scorecard with run variability where useful:
   - FCP target: `<= 1.8 s`
   - LCP target: `<= 2.5 s`
   - TBT target: `<= 200 ms`
   - CLS target: `<= 0.10`
3. The LCP element and subpart breakdown.
4. The top three main-thread bottlenecks with script URLs and attributable blocking duration where supported.
5. The largest or most problematic network resources and third-party impact.
6. Prioritized recommendations grouped as quick wins, medium-effort improvements, and structural improvements.

Separate measured evidence from inference. Prefer fixes tied to observed bottlenecks, and state when attribution or timing is unavailable.
