# Suttons & Robertsons — Webflow client bundle

Front-end JavaScript for the Suttons & Robertsons Webflow site. The built bundle
(`dist/loader.js`) is loaded by the live site via jsDelivr.

```bash
npm install     # installs deps + the build hook
npm run build   # bundles loader.js → dist/loader.js
npm test        # vitest
npm run test:e2e # playwright
```

Loaded on the site with:

```html
<script type="module"
  src="https://cdn.jsdelivr.net/gh/suttonsandrobertsons/suttons-robertsons-public@COMMIT_SHA/dist/loader.js"></script>
```

Documentation is maintained separately. `SIMPLE.md` / `AGENTS.md` / `CLAUDE.md` are
notes for AI coding assistants and have no effect on the built bundle.
