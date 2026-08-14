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

## Immutable E1 evidence

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

The E1 JSON captures include the SHA-256 of their `dist/.vite/manifest.json`.
They preserve the accepted E1 baseline and are no longer inputs to the current
`npm run size`.

## Current E2 evidence

- `network-e2-cold.har` and `network-e2-cold.json` — fresh production load
  through editor-ready, before source focus or any regex action.
- `network-e2-cumulative.har` and `network-e2-cumulative.json` — a separate
  fresh load followed by source focus and the full E2 document-tools inventory:
  ten individual cleaners, the 100,000-character cleaning run, format, minify,
  literal and batch replacement, isolated regex timeout, remove and common undo.
- `network-e2-har-result.json` — sanitized HAR 1.2 assertions, including the
  flattened page/Worker CDP lifecycle. Page and Worker events are coalesced only
  by their documented request ID; the Worker has real response, data and
  `Network.loadingFinished` events, with no synthetic sizes or terminal event.
- `size-e2-result.json` — the current-dist SHA-256 inventory, all four byte
  budgets, cold request-count gate and the 100,000-character browser timing.

The E2 captures include the SHA-256 of the current manifest. `npm run size`
refuses stale captures, requires exactly two dynamic entries (`source-rich` and
`safe`), allows exactly one emitted `regex-worker` asset, requires those three
JavaScript resources only in cumulative, and rejects TinyMCE default icons,
Mammoth, DOCX and fixture requests.

The flattened Worker lifecycle provides its complete decoded size and a real
terminal event, but Chrome does not expose a byte-accurate split between HTTP
headers and the gzip body across the page/Worker sessions. Its HAR entry keeps
the observed encoded length, marks `headersSize` and `bodySize` as unknown
(`-1`), omits `content.compression`, and records the limitation explicitly.
The four budget values never use HAR wire sizes: `npm run size` deterministically
compresses the exact current `dist` files with gzip level 9 and Brotli quality 11.
