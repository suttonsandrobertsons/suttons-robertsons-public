# Simple

## Reality

- Stage and users: live production. `dist/loader.js` is the front-end bundle for
  every page of `www.suttonsandrobertsons.com`, a Webflow site. Public repository,
  client-owned.
- Operators: Spurwing develops and builds; the client publishes Webflow and edits
  the CMS. There is no deploy step here — publishing is a Webflow publish.
- External consumers: yes, and this is the load-bearing fact. Webflow's custom code
  loads `dist/loader.js` from jsDelivr at a pinned commit SHA (or `@main`). The
  committed bundle *is* the artefact; `.githooks/pre-commit` rebuilds and stages it
  so it cannot drift from `src/`.
- Public contracts:
  - Hidden field names written on submit (`gold_*`, `all_files_url`,
    `lead_reference`, `combined_asset_type`, UTM/GCLID fields). Zapier maps these
    onto Zoho lead fields by name.
  - The `data-form-*` attribute vocabulary that the Webflow Designer markup uses.
  - CMS `Input Value` strings that `gold.js` and the condition engine match on.
- Persistent production data: none in this repository. Live submissions become Zoho
  leads and R2 uploads; the reference generated here is stored on both.
- Compatibility commitments: renaming a hidden field, a form key in `leadFormKeys`,
  or a matched CMS value changes live lead capture. Nothing throws — the field
  simply lands nowhere, or a card silently stops appearing.
- Scale and failure consequences: one bundle serves every page; the footer form
  alone appears on ~164 of them. A broken bundle takes out all forms sitewide, and
  failure is silent rather than visible.

## Preserve

- Two matching regimes, and they behave oppositely. `gold.js` compares through
  `normalizeSlug()` (case- and punctuation-insensitive); Webflow `show-if`/`hide-if`
  rules compare exactly and case-sensitively. `derived-fields.js` compares
  `asset_type === 'Other'` exactly. Know which one applies before renaming a value.
- Every £ amount a customer or Zoho sees is a whole pound, and totals are the sum of
  whole-pound line items — not the rounded sum. This is what makes the on-screen
  figures foot and match the Zoho record.
- `LOAN_RATE_BANDS` in `config.js` is one shared constant behind both the gold and
  loan calculators, so a rate change cannot apply to only one of them.
- `uploads.allowedMimeTypes` / `allowedExtensions` in `config.js` mirror
  `ALLOWED_TYPES` / `ALLOWED_EXTENSIONS` in the Worker repository. Update both.
- The `X-Suttons-Client` header value here is paired with the Worker's
  `client-guard.js`. Rotate them together.

## Current boundary

- The bundle serves this one Webflow site. Its reachable surface is the Worker
  (`uploads.workerBase`) and the native Webflow form POST to Zapier. Reconsider
  generality when a second site loads it, or when Zoho is called directly instead of
  through Zapier.

## Ordinary paths

- Behaviour changes live in `src/modules/**`; `loader.js` is the entry point.
- `npm run build` (esbuild) produces `dist/loader.js`; let the pre-commit hook run it.
- Shipping a change: commit and push, bump the pinned SHA in the Webflow Designer
  embed if it is pinned, then publish the site.
- Documentation for this repository lives in the private companion repository under
  `docs/`. Behaviour changes belong in the same change as the doc update.

## Proof

- `npm test` — vitest, `src/**/__tests__/`. The gold arithmetic and rounding are
  asserted in `src/modules/forms/__tests__/gold-calculations.test.js`.
- `npm run test:e2e` — Playwright, `e2e/`.
- Independent surface: submit a real enquiry on the live site and confirm the lead
  arrives in Zoho with the expected fields and figures.

## Reconsider when

- A second site or a published client starts loading this bundle.
- Zapier is removed and the site talks to Zoho directly, which would move the field
  contract.
- Webflow gains the conditional-logic and validation this bundle exists to supply.
