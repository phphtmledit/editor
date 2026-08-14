# phphtmledit editor

Browser-only WYSIWYG HTML editor focused on cleaning copied and generated markup. The application uses a self-hosted TinyMCE 8 visual editor and does not send document contents to a backend or to Tiny Cloud.

**E1 — the two-panel editor skeleton and focus-authority synchronization are
complete.** TinyMCE and CodeMirror 6 now share one HTML fragment; the verified
stage evidence is documented in `docs/E1.md`. The immutable E0 risk-gate report
remains in `docs/E0.md`.

On desktop the visual and source panels share a keyboard- and pointer-adjustable
splitter. Below 900 px they become accessible tabs. TinyMCE-to-source updates
use a 300 ms trailing delay, source-to-TinyMCE updates use 500 ms, and a focus
change flushes the outgoing panel immediately. Cleaning, import/export, final
themes and embedding controls are intentionally reserved for later stages.

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
npm run licenses
npm run legal
npm run icons
npm run size
npm audit --audit-level=high
```

`npm run build` creates deployable `dist` with no diagnostic fixtures.
`npm run build:e0` additionally creates `dist-e0` and runs the strict boundary
check: the production graph must contain no DOCX/golden fixture while the
diagnostic graph must contain both fixtures exactly once.

`npm run size` consumes the sanitized E1 production-preview captures in
`reports/network-e1-cold.json` and `reports/network-e1-cumulative.json`, checks
their manifest fingerprint against the current `dist`, and applies the four
byte budgets plus the request-count limit. See `docs/E1.md` for the current
measurements.

The original E0 HAR/JSON files are preserved unchanged. Current independent
DevTools Network-domain evidence is in `reports/network-e1-cold.har` and
`reports/network-e1-cumulative.har`; `reports/network-e1-har-result.json`
records its assertions.

`npm run icons` is a permanent pre-report gate. It verifies the generated
68-icon pack against the current visual toolbar, menus, dialogs and fallback
assertions; it is not limited to E0.
