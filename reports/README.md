# E0 reports

Generated and captured evidence for the E0 risk gate is kept here.

- `network-cold.har` — Chrome DevTools Protocol Network-domain capture through
  editor-ready, with cache disabled and the service worker bypassed.
- `network-full.har` — fresh cumulative capture through the plugin dialogs and
  lazy production DOCX runtime load.
- `network-har-result.json` — assertions over both sanitized HAR 1.2 files.

- `tinymce-assets.json` — byte counts and SHA-256 hashes of copied TinyMCE files.
- `mammoth-result.json` — golden-output comparison and semantic tag inventory.
- `icon-visual-result.json` — toolbar/menu/dialog visual icon checklist and fallback assertions.
- `network-cold.json` — sanitized editor-ready `PerformanceResourceTiming` inventory.
- `network-full.json` — sanitized production timing inventory after dialogs and lazy Mammoth load; no fixture request.
- `size-result.json` — current `dist` SHA-256 values, the four byte-budget checks
  (cold and cumulative transfer in gzip and brotli), the cold request-count
  check, and supplementary non-budget details such as initial application JS.
- `docs/E0.md` — final comparison with the budgets in `docs/TZ.md` §7.

The two network JSON files remain deterministic inputs to `npm run size`. The
HAR files are the authoritative DevTools Network-domain evidence required by
`AGENTS.md` §E0.3; they were captured from the final production build rather
than from the diagnostic build.
