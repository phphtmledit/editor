# Stage evidence

## Immutable E0 evidence

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

These files preserve the accepted E0 baseline. They are no longer inputs to the
current `npm run size`, and later stages do not overwrite them.

## Current E1 evidence

- `network-e1-cold.har` and `network-e1-cold.json` — fresh production load
  through TinyMCE plus the eager CodeMirror HTML grammar/highlighting, before
  source focus.
- `network-e1-cumulative.har` and `network-e1-cumulative.json` — a separate
  fresh load followed by first source focus and lazy activation of autocomplete,
  folding and tag-matching tools.
- `network-e1-har-result.json` — cache, service-worker, origin, request,
  console, icon, fixture, eager-pre-focus-highlighting and lazy-entry assertions
  over both sanitized HARs.
- `size-e1-result.json` — current-dist SHA-256 inventory and the four byte
  budgets plus request-count gate.
- `docs/E1.md` — implementation and stage conclusion.

The E1 JSON captures include the SHA-256 of `dist/.vite/manifest.json`.
`npm run size` refuses a stale capture, requires exactly one lazy dynamic entry
(`src/editor/source-rich.ts`), and rejects diagnostic/future-stage resources.
