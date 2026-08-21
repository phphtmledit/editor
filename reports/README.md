# Stage evidence

## Rolling permanent evidence

- `icon-visual-result.json` — rolling toolbar/menu/dialog visual icon checklist,
  fallback assertions, and the six project-authored file/clipboard action-icon
  contracts; accepted stage extensions are appended without discarding the
  earlier scenarios.
- `e5-about-menu.png`, `e5-link-dialog.png` — reviewed E5 Chromium captures for
  the About menu and token-driven Oxide focus/primary states; SHA-256 values are
  pinned by the rolling icon report.
- `e5-palette-visual.json` — computed native-control and Oxide menu/dialog
  colors, the reviewed screenshot hashes, and the post-change contrast minimum.

## Immutable E0 evidence

- `network-cold.har` — Chrome DevTools Protocol Network-domain capture through
  editor-ready, with cache disabled and the service worker bypassed.
- `network-full.har` — fresh cumulative capture through the plugin dialogs and
  lazy production DOCX runtime load.
- `network-har-result.json` — assertions over both sanitized HAR 1.2 files.

- `mammoth-result.json` — golden-output comparison and semantic tag inventory.
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

## Immutable E4 evidence

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

These E4 captures preserve the accepted interface baseline and are no longer
inputs to the current `npm run size`. The E5 captures retain the same manifest,
DOCX, dynamic-entry, Worker, fixture, dark-skin, action, paint, budget, and
request-count invariants while adding the E5 legal-link assertions.

## Current E5 evidence

- `network-e5-cold.har` and `network-e5-cold.json` — fresh production load
  through editor-ready, bound to the current production manifest and served
  HTML.
- `network-e5-cumulative.har` and `network-e5-cumulative.json` — separate fresh
  load with the complete E2/E3/E4 action inventory plus the E5 About menu and
  legal-link checks.
- `network-e5-har-result.json` — 53 successful Network, lifecycle, lazy-entry,
  Worker, fixture-boundary, About-popup, license-delivery, palette, contrast,
  touch-target, busy-panel-visibility, and no-unexpected-console-problem
  assertions. The new painted-busy-state assertion requires the skeleton to
  cover FP/FCP, both editor panels to remain `visibility: hidden` until ready,
  and both initialized panels to be visible afterward. An exact Chrome advisory
  for the intentional paint-handoff TinyMCE preload is retained separately when
  observed; every other warning, error, or exception blocks.
- `size-e5-result.json` — current-dist hashes and local gzip-9/Brotli-11 lower
  estimates: 574,696/488,672 B cold, 719,386/606,449 B cumulative, with 18/22
  requests.
- `performance-e5-desktop-gate.json` — blocking three-run medians from a
  dedicated CDP harness using the exact Lighthouse desktop transport settings,
  not Lighthouse CLI audits: 10,240 kbit/s, 40 ms latency, no CPU slowdown,
  792.0 ms to skeleton, 1,682.2 ms to trusted input, and 586,005 B full wire.
- `performance-e5-slow4g-comparison.json` — published non-absolute-threshold
  diagnostic: accepted E4 trusted-input readiness 8,529.3 ms versus E5
  6,305.6 ms (−26.071%). E4 skeleton timing is not comparable because only one
  of three runs proved the skeleton at FCP; E5 proves it in all three.
- `performance-e5-slow4g-fresh-baseline-invalid-attempt.json` — the preserved
  fresh comparison attempt whose E4 side completed only 2/3 strict whole-run
  captures. It contributes no replacement baseline or regression metric; its
  three valid current-E5 runs are byte-for-byte embedded in the accepted
  derived comparison.
- `performance-e5-ready-gap.json` — historical `dc818598` same-navigation
  comparison of the 5,222.0 ms product editor-ready mark and 5,397.5 ms trusted
  input, a 175.5 ms gap with no rich-source request. It validates the mark's
  meaning and is not relabelled as a current-build timing run.
- `performance-e5-ready-gap-invalid-attempt.json` — preserved audit of the
  unparsable first harness readback. It contributes no metric and records why
  one replacement run was necessary.
- `delivery-e5-production-wire.json` — historical `dc818598` encoding matrix:
  three deployed runs and 54/54 Brotli response observations, with a 586,042 B
  full-wire median. The current blocking wire value comes from the current
  desktop report and is not substituted by this older diagnostic.
- `e5-palette-visual.json`, `e5-about-menu.png`, and `e5-link-dialog.png` — exact
  accent/soft-accent, native-control, Oxide, contrast, and reviewed visual
  evidence.

The local Brotli-11 value and deployed full-wire value are deliberately
different measurements. The former recompresses a manifest-bound local graph
and is a lower estimate; the latter observes a separate deployed graph at a
different capture time and includes hosting compression plus HTTP/2 overhead.
Neither value may be substituted for the other.

## Original E5 host baseline before embedding

- `lighthouse-host-baseline-e5.json` — the English five-run summary and medians
  for `https://phphtmledit.com/` before any iframe was inserted.
- `lighthouse-host-baseline-e5-run-1.json` through
  `lighthouse-host-baseline-e5-run-5.json` — complete portable Lighthouse JSON
  inputs whose SHA-256 values are pinned by the summary.

The page contained zero iframes and made zero requests to
`app.phphtmledit.com` in all five runs. Median FCP/LCP is 1,753.5425 ms, Speed
Index is 1,988.316824 ms, TBT is 0 ms, and CLS is 0.0000592733; the median
Performance score of 99 is reference-only. This baseline is immutable.

The series predates specification 2.9 and does not contain the required
first-viewport slot geometry or per-run frame-load state. It remains historical
evidence. A new instrumented five-run pre-iframe baseline was subsequently
captured before iframe insertion and is the comparison input for the separately
stored post-embed series using the identical profile and slot position. Neither
instrumented series may overwrite this historical one.

The current verified E5 production candidate was built from commit
`45ff34b568e7e21f53dbc794a05c606b51bdc93d`; its immutable Cloudflare URL is
`https://97794bf1.phphtmledit-editor.pages.dev/`. The custom domain is
**Active** with SSL enabled and visibly serves E5, including the About menu.
Live root, hashed-asset, and `/licenses.txt` headers have been verified.

The portable criterion-12 package consists of
`host-instrumented-e5.json`, five `before` LHR/probe pairs, and five `after`
LHR/probe pairs. The permanent hosting evidence verifier checks every hash, the exact
profile and slot geometry, frame-load evidence, current build entrypoints, and
independently recomputed medians. No ignored `work/` file or machine-local path
is required. The manifest SHA-256 is
`b3a06a0de261489441deb398d2b9628a61cde405b93cd0637730c4618c44f8fa`.

The before medians are 1,931.0523 ms FCP/LCP, 2,434.91882 ms Speed Index,
0 ms TBT, and 0 CLS. Attempt 4 keeps the same first-viewport slot and proves the
iframe loaded in all five runs. Its medians are 2,743.3753 ms FCP/LCP,
3,300.734963 ms Speed Index, 416.0 ms TBT, and 0 CLS. The busy-editor guard
therefore fixes the application-subframe CLS completely, but FCP, LCP, Speed
Index, and TBT still fail criterion 12. The manifest deliberately records
`measurementValidity.passed=true`, `criterion12.passed=false`, and result
`measurement-valid-criterion12-failed`. `npm run hosting:evidence` verifies the
package and requires that truthful result; default `npm run hosting` then exits
nonzero on criterion 12. Allowed-origin clipboard/framing, the no-permission
clipboard fallback, and the denied `phe-preview.com` framing check also remain
pending under criteria 7 and 14.
