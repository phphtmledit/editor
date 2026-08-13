# phphtmledit editor

Browser-only WYSIWYG HTML editor focused on cleaning copied and generated markup. The application uses a self-hosted TinyMCE 8 visual editor and does not send document contents to a backend or to Tiny Cloud.

**E0 — preparation and risk validation is complete.** Product implementation
has not started; the verified baseline and gate evidence are documented in
`docs/E0.md`.

## License

This project is licensed under **GPL-2.0-or-later**. It includes TinyMCE, © Tiny Technologies, Inc., distributed under GPL-2.0-or-later. See `LICENSE` and `THIRD-PARTY-NOTICES.md`.

Each generated application bundle points to `/licenses.txt`, the single
third-party license artifact produced by the build. The `.txt` extension is
intentional: static hosting serves it as UTF-8 plain text so following the URL
opens the notices in the browser instead of downloading an opaque `.md` file.

## E0 commands

```text
npm ci
npm run build:e0
npm run check
npm run e0:docx
npm run licenses
npm run e0:legal
npm run icons
npm run size
npm audit --audit-level=high
```

`npm run build` creates deployable `dist` with no diagnostic fixtures.
`npm run build:e0` additionally creates `dist-e0` and runs the strict boundary
check: the production graph must contain no DOCX/golden fixture while the
diagnostic graph must contain both fixtures exactly once.

`npm run size` consumes the sanitized production-preview captures in
`reports/network-cold.json` and `reports/network-full.json`. See `docs/E0.md`
for the measured budgets, limitations and gate conclusion.

The independent DevTools Network-domain evidence is preserved as sanitized
HAR 1.2 files in `reports/network-cold.har` and `reports/network-full.har`;
`reports/network-har-result.json` records their assertions.

`npm run icons` is a permanent pre-report gate. It verifies the generated
68-icon pack against the current visual toolbar, menus, dialogs and fallback
assertions; it is not limited to E0.
