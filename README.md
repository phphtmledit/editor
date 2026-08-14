# phphtmledit editor

Browser-only WYSIWYG HTML editor focused on cleaning copied and generated markup. The application uses a self-hosted TinyMCE 8 visual editor and does not send document contents to a backend or to Tiny Cloud.

**E3 — import, export, local drafts and their weight reductions are implemented.**
TinyMCE and CodeMirror 6 share one HTML fragment, while ten independently
testable cleaning rules remove Word/Office markup, presentation attributes,
empty structures and typographic artifacts. The verified stage evidence is
documented in `docs/E3.md`; the accepted E0, E1 and E2 reports remain unchanged
in `docs/E0.md`, `docs/E1.md` and `docs/E2.md`.

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
Final themes/accessibility, embedding and legal interface work, and E6 manual
acceptance remain later stages.

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
npm run size
npm audit --audit-level=high
```

`npm run build` creates deployable `dist` with no diagnostic fixtures.
`npm run build:e0` additionally creates `dist-e0` and runs the strict boundary
check: the production graph contains the lazy Mammoth runtime used by DOCX
import but no DOCX/golden fixture, while the diagnostic graph contains the
Mammoth DOCX/golden pair exactly once. Every other test fixture remains absent
from both builds.

`npm run size` consumes the sanitized E3 production-preview captures in
`reports/network-e3-cold.json` and `reports/network-e3-cumulative.json`, checks
their manifest fingerprint against the current `dist`, and applies the four
byte budgets plus the request-count limit. See `docs/E3.md` for the current
measurements.

The accepted E0, E1 and E2 HAR/JSON files are preserved unchanged. Current
independent DevTools Network-domain evidence is in
`reports/network-e3-cold.har` and `reports/network-e3-cumulative.har`;
`reports/network-e3-har-result.json` records its assertions.

`npm run vendor:tinymce` deterministically generates the 300-entry common emoji
database from TinyMCE 8.8.2/emojilib data. The stock database is not shipped.
Copyright, license and dated modification provenance is recorded in
`THIRD-PARTY-NOTICES.md` and delivered through `/licenses.txt`.

`npm run icons` is a permanent pre-report gate. It verifies the generated
68-icon pack against the current visual toolbar, menus, dialogs and fallback
assertions; it is not limited to E0.
