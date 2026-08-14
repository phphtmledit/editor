# Stage evidence

## Immutable E0 evidence

- `network-cold.har` — Chrome DevTools Protocol Network-domain capture through
  editor-ready, with cache disabled and the service worker bypassed.
- `network-full.har` — fresh cumulative capture through the plugin dialogs and
  lazy production DOCX runtime load.
- `network-har-result.json` — assertions over both sanitized HAR 1.2 files.

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

## Immutable E2 evidence

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

The E2 captures include the SHA-256 of their manifest. They preserve the
accepted E2 baseline and are no longer inputs to the current `npm run size`.

The flattened Worker lifecycle provides its complete decoded size and a real
terminal event, but Chrome does not expose a byte-accurate split between HTTP
headers and the gzip body across the page/Worker sessions. Its HAR entry keeps
the observed encoded length, marks `headersSize` and `bodySize` as unknown
(`-1`), omits `content.compression`, and records the limitation explicitly.
The four budget values never use HAR wire sizes: `npm run size` deterministically
compresses the exact current `dist` files with gzip level 9 and Brotli quality 11.

## Immutable E3 evidence

- `network-e3-cold.har` and `network-e3-cold.json` — fresh production load
  through editor-ready, before source focus, regex replacement or DOCX import.
- `network-e3-cumulative.har` and `network-e3-cumulative.json` — a separate
  fresh load containing every cold request, eager highlighting and first source
  focus, the complete E2 cleaning/replacement inventory, custom emoji dialog
  search and insertion, HTML import, an actual drop of
  `tests/fixtures/mammoth-fixture.docx` into the TinyMCE iframe, HTML download,
  HTML/text clipboard actions, product sample, draft autosave and new document.
- `network-e3-har-result.json` — sanitized HAR 1.2 assertions over both captures,
  bound to the production manifest and DOCX-fixture SHA-256 values. It verifies
  local GET-only traffic, disabled cache/service worker, custom icons and emoji,
  lazy entries, the real regex Worker lifecycle, the actual DOCX-triggered
  Mammoth request, absence of fixtures and a clean console.
- `size-e3-result.json` — exact current-dist SHA-256 inventory, the four byte
  budgets, cold request-count gate, complete UI-action inventory and the
  100,000-character cleaning timing.

`npm run size` refuses stale E3 captures. The product manifest must have exactly
three dynamic entries: `source-rich`, `safe` and `mammoth-browser`. Those three
files plus the single emitted `regex-worker` are the only JavaScript additions
allowed in the cumulative scenario. Mammoth must be absent from cold and loaded
exactly once by the recorded DOCX drop. The custom emoji database must be loaded
exactly once in both scenarios; the stock database must be absent from both the
network and `dist`. DOCX/fixture files are rejected from `dist` and the network.

As in E2, the split page/Worker lifecycle exposes an exact decoded Worker size
but no reliable encoded header/body split. The E3 HAR therefore preserves the
observed encoded length, records `headersSize` and `bodySize` as `-1`, omits
`content.compression`, and keeps byte-budget calculation independent by
compressing the exact manifest-bound `dist` files with gzip level 9 and Brotli
quality 11.

The E3 files preserve the accepted baseline and are no longer inputs to the
current `npm run size`.

## Current E4 evidence

- `dark-assets-removal-e4.json` - reproducible before/after measurement for the
  three excluded TinyMCE dark-skin assets. It pins the accepted E3
  `tinymce-assets.json` canonical inventory SHA-256 instead of relying on the
  rolling file's current bytes.
- `tinymce-assets.json` - rolling byte and SHA-256 inventory for the current
  copied TinyMCE allow-list. The build regenerates this file, so it describes
  the current distribution and is not immutable E0 evidence.
- `network-e4-cold.har` and `network-e4-cold.json` - a fresh 1440x1000 desktop
  production load through editor-ready, with cache disabled and the service
  worker bypassed.
- `network-e4-cumulative.har` and `network-e4-cumulative.json` - a separate
  fresh desktop load containing every cold request and the complete E3 action
  inventory: source tools, isolated regex Worker, custom emoji search/insert,
  HTML and real DOCX import, export, clipboard, sample, draft and new document.
- `network-e4-har-result.json` - all sanitized HAR, manifest, dynamic-entry,
  Worker, Mammoth, custom-icon, custom-emoji, fixture-boundary and UI assertions.
- `size-e4-result.json` - exact current-dist SHA-256 inventory, the four byte
  budgets, cold request-count gate, UI evidence and browser timing.
- `performance-e4-4g-diagnostic.json` - a separate 1.6 Mbps down / 750 Kbps up /
  150 ms latency loading profile. It is not a HAR, is not a byte-budget input,
  and does not replace either canonical Network capture.

The isolated E4 UI audit runs in a separate CDP browser without `Network.enable`,
so it cannot add URLs to either byte inventory. It verifies light-only handling
for the empty, `light`, `dark`, `auto` and unsupported theme queries; desktop
split layout at 1440, 1024 and 900 px; mobile tabs at 899, 768, 390 and 320 px;
nonzero active editors and no horizontal overflow; every visible app/TinyMCE
button at least 44x44 under coarse-pointer emulation; five computed contrast
pairs at or above 4.5:1; solid accent keyboard focus; `visualViewport` resize
variables; DOCX busy-state restoration; and the intentional absence of About
before E5.

Loading-state proof comes from a document-start state sampler, buffered
`PerformancePaintTiming`, Resource Timing, and five fixed product marks. Built
HTML must contain exactly one preload for
`/tinymce/tinymce.min.js?v=8.8.2` and no executable TinyMCE core script. Both
fresh Network scenarios require the nonzero busy skeleton to span FP and FCP,
then require the exact mark order paint handoff → dynamic script insertion →
runtime loaded → initialization started → editor ready. The executable script,
load event, initialization call, and exact Tiny core network resource each occur
once. Three diagnostic durations are preserved: navigation to first skeleton
paint, skeleton paint to the product editor-ready mark, and their exact total.

The separate 4G report applies CDP network throttling without CPU throttling and
records the same preload, paint, dynamic-loader, runtime, initialization, and
ready ordering. Its `budgetInput` and `canonicalHar` fields are both false.

`npm run size` now refuses stale or non-E4 captures. The captures must match the
current manifest and DOCX fixture, retain exactly the three dynamic entries and
single regex Worker, contain no fixture or dark-skin request, and pass the full
E3 action inventory plus every E4 UI and paint assertion before the four byte
budgets and 25-request ceiling can pass.
