# phphtmledit editor

Browser-only WYSIWYG HTML editor focused on cleaning copied and generated markup. The application uses a self-hosted TinyMCE 8 visual editor and does not send document contents to a backend or to Tiny Cloud.

The deployment target `https://app.phphtmledit.com/` is live. Its Cloudflare
Pages custom-domain status is **Active** and SSL is enabled. The first verified
E5 production application deployment was built from commit
`b3dc011b5f3381e10237f6af6c2c7f7a55d9e955`; its immutable Cloudflare URL is
`https://0e13e6fa.phphtmledit-editor.pages.dev/`. The custom domain visibly
serves E5, including the About menu. Live root, hashed-asset, and
`/licenses.txt` headers have been verified. The public source repository is
`https://github.com/phphtmledit/editor`.

**The deployed E5 candidate adds embedding, browser-visible legal links,
action icons, and a Cloudflare Pages delivery policy to the accepted E4
interface.**
TinyMCE and CodeMirror 6 share one HTML fragment, while ten independently
testable cleaning rules remove Word/Office markup, presentation attributes,
empty structures and typographic artifacts. The verified stage evidence is
documented in `docs/E5.md`; the accepted E0–E4 reports remain unchanged in
`docs/E0.md` through `docs/E4.md`. The E5 implementation candidate is merged
and deployed. Host integration still requires a new instrumented pre-iframe
baseline, iframe insertion, post-embed Lighthouse, and framing checks listed in
the E5 report.

On desktop the visual and source panels share a keyboard- and pointer-adjustable
splitter. Below 900 px they become accessible tabs. TinyMCE-to-source updates
use a 300 ms trailing delay, source-to-TinyMCE updates use 500 ms, and a focus
change flushes the outgoing panel immediately. Cleaning and replacement use a
separate mass-write path: both native editor histories are reset and a single
application stack can undo the last ten cleaning or replacement operations.
Potentially pathological regular expressions run in a disposable Worker with a
500 ms timeout. HTML/HTM and lazy DOCX import accept files up to 5 MiB through
the picker or file drop. The application downloads HTML, copies HTML or plain
text, saves a local draft every 3 seconds up to 1 MiB, and provides sample/new
document actions. Whole-document changes join the same mass-operation stack.
The English interface uses one tokenized light palette, preserves visible focus,
switches to 44 px touch targets and editor tabs below 900 px, follows the mobile
`visualViewport`, and exposes loading, DOCX progress, and fatal-error states.
The `?theme=` parameter remains stable, but every value resolves to the light
theme in the MVP; `color-scheme: light` is applied to the shell and editor frame.
The TinyMCE `About` menu opens the public source repository and the generated
third-party notices in new tabs. Cross-origin embedding is documented in
[`docs/EMBEDDING.md`](docs/EMBEDDING.md); E6 remains the final manual acceptance
stage.

## Embedding and hosting

Use the exact lazy iframe contract in [`docs/EMBEDDING.md`](docs/EMBEDDING.md).
The production build emits a Cloudflare Pages `_headers` artifact that keeps
the application out of search indexes, limits `frame-ancestors`, applies
immutable caching only to hashed `/assets/*`, and serves `/licenses.txt` as
UTF-8 plain text. It deliberately does not emit `X-Frame-Options`.

The build accepts three public configuration values:

```text
VITE_SOURCE_URL=https://github.com/phphtmledit/editor
VITE_NOTICES_URL=/licenses.txt
FRAME_ANCESTORS="'self' https://phphtmledit.com https://www.phphtmledit.com http://localhost:*"
```

`FRAME_ANCESTORS` is validated at build time. It must retain all four required
sources, cannot contain additional CSP directives, and must never include
`phe-preview.com`, which is reserved for the negative framing test.
In the Cloudflare dashboard, enter the value itself without the outer double
quotes used by dotenv syntax.

## License

This project is licensed under **GPL-2.0-or-later**. It includes TinyMCE, © Tiny Technologies, Inc., distributed under GPL-2.0-or-later. See `LICENSE` and `THIRD-PARTY-NOTICES.md`.

Each generated application bundle points to `/licenses.txt`, the single
third-party license artifact produced by the build. The `.txt` extension is
intentional: static hosting serves it as UTF-8 plain text so following the URL
opens the notices in the browser instead of downloading an opaque `.md` file.

## Development commands

```text
npm ci
npm run build
npm run check
npm run test
npm run licenses
npm run legal
npm run icons
npm run hosting
npm run size
npm run performance
npm audit --audit-level=high
```

`npm run build` creates deployable `dist` with no diagnostic fixtures.
`npm run build:e0` additionally creates `dist-e0` and runs the strict boundary
check: the production graph contains the lazy Mammoth runtime used by DOCX
import but no DOCX/golden fixture, while the diagnostic graph contains the
Mammoth DOCX/golden pair exactly once. Every other test fixture remains absent
from both builds.

For Cloudflare Pages, use `npm run build` as the build command and `dist` as the
output directory. The Pages custom-domain association for
`app.phphtmledit.com` is **Active**, SSL is enabled, and the E5 application was
verified against immutable deployment `https://0e13e6fa.phphtmledit-editor.pages.dev/`
from commit `b3dc011b5f3381e10237f6af6c2c7f7a55d9e955`. The live root, hashed-asset,
and license-delivery headers have been verified.

`npm run size` consumes the sanitized E5 production captures in
`reports/network-e5-cold.json` and `reports/network-e5-cumulative.json`, checks
their manifest fingerprint against the current `dist`, and applies the four
local byte budgets plus the request-count limit. `npm run performance` checks
the blocking desktop startup medians, the non-blocking Slow 4G regression
diagnostic, and the deployed 650,000-byte full-wire ceiling. See `docs/E5.md`
for the current measurements.

The accepted E0–E4 stage-specific Network, size, and report evidence is
preserved unchanged. `reports/tinymce-assets.json` is deliberately a rolling,
reproducible inventory of the current vendored distribution; the E4 reduction
report pins the accepted E3 inventory hash used as its baseline. Current
independent DevTools Network-domain evidence is in
`reports/network-e5-cold.har` and `reports/network-e5-cumulative.har`;
`reports/network-e5-har-result.json` records its 52 successful assertions.

`npm run vendor:tinymce` deterministically generates the 300-entry common emoji
database from TinyMCE 8.8.2/emojilib data. The stock database is not shipped.
Copyright, license and dated modification provenance is recorded in
`THIRD-PARTY-NOTICES.md` and delivered through `/licenses.txt`.

The TinyMCE distribution is light-only. `npm run e4:dark-assets-removal`
reproduces the isolated raw, gzip-9, and Brotli-11 savings from excluding the
three unused dark-skin files while keeping all copied vendor files byte-identical.

`npm run icons` is a permanent pre-report gate. It verifies the generated
68-icon pack against the current visual toolbar, menus, dialogs and fallback
assertions; it is not limited to E0.
