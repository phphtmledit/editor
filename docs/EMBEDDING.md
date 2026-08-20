# Embedding the phphtmledit editor

The editor is a separate browser application served from
`https://app.phphtmledit.com/`. It has no backend and does not send document
contents to the host page, Tiny Cloud, analytics services, or any other
endpoint. The host and the editor remain separate applications and separate
origins.

## Required iframe

Reserve the iframe height in the initial host layout so loading the editor does
not cause layout shift:

```html
<iframe
  src="https://app.phphtmledit.com/?theme=auto"
  style="width:100%;height:760px;border:0;display:block"
  title="HTML editor"
  loading="lazy"
  allow="clipboard-write"
></iframe>
```

Keep every attribute shown above:

- `loading="lazy"` keeps the editor out of the host page's initial critical
  path when it starts below the viewport.
- A reserved `height` prevents iframe-attributable CLS. The host may choose a
  different fixed height, but it must reserve that space before the editor
  loads.
- `allow="clipboard-write"` delegates the modern Clipboard API to the
  cross-origin frame. Without it, the editor can only attempt its legacy
  fallback and never reports a copy as successful unless the fallback worked.
- `title` gives the embedded application an accessible name.

Do **not** add `sandbox`. It breaks downloads and clipboard behavior; the
separate origin provides the intended isolation. Do not add
`allow="fullscreen"`: fullscreen mode is outside the MVP and the TinyMCE
fullscreen plugin is not shipped.

## URL parameters

The `theme` parameter is stable, but the MVP is intentionally light-only.
Missing, `light`, `dark`, `auto`, and unsupported values all resolve to the
light token set. The application explicitly declares `color-scheme: light`.

There is no `postMessage` API in the MVP. Do not build host-to-editor commands
or document exchange around undocumented window messages.

## Framing policy

The editor response uses CSP `frame-ancestors` as its only origin allow-list.
The production policy permits:

```text
'self' https://phphtmledit.com https://www.phphtmledit.com http://localhost:*
```

The list is supplied at build time through `FRAME_ANCESTORS`. The application
does not duplicate it in JavaScript. `phe-preview.com` is deliberately absent:
that origin is reserved for the negative framing test and must never be added,
even temporarily.

When entering `FRAME_ANCESTORS` in the Cloudflare dashboard, use the value
itself (`'self' https://...`) without wrapping the complete value in double
quotes. The outer double quotes in `.env.example` are dotenv file syntax.

If a browser refuses to render the editor, inspect the editor document's
`Content-Security-Policy` response header and the exact host origin. Do not add
`X-Frame-Options`; it cannot express the required multi-origin policy and may
conflict with CSP.

## Privacy and local state

Imported files, pasted content, editor changes, cleanup operations, and exports
run entirely inside the editor frame. Drafts and preferences use the editor
origin's `localStorage`, not the host origin's storage. The host page should not
attempt to read or mirror editor state.

## Lighthouse comparison

Measure the public host **before** inserting the iframe. Run Lighthouse five
times with one fixed profile and calculate independent medians for FCP, LCP,
Speed Index, TBT, and CLS. After adding the exact iframe, repeat the same
five-run profile on the same page and compare those five median metrics. The
iframe must add zero CLS.

Publish the composite Performance score for reference only. Do not use it as
an acceptance gate: its run-to-run variance is larger than the former
two-point allowance.

The pre-iframe baseline for `https://phphtmledit.com/` is recorded in
`reports/lighthouse-host-baseline-e5.json`. Its five-run medians are
1,753.5425 ms FCP, 1,753.5425 ms LCP, 1,988.3168240007462 ms Speed Index,
0 ms TBT, and 0.00005927330338111205 CLS; the reference Performance score is
99. Do not overwrite this baseline with the post-embed measurement.

## Deployment checks

After every deployment, verify all of the following against the live custom
domain:

1. `/` returns `X-Robots-Tag: noindex, nofollow` and the expected
   `frame-ancestors` CSP.
2. A hashed `/assets/*` response returns
   `Cache-Control: public, max-age=31536000, immutable`.
3. `/licenses.txt` opens in the browser as
   `text/plain; charset=utf-8` and has no attachment disposition.
4. The iframe works on `phphtmledit.com` with clipboard delegation.
5. The same iframe is rejected on `phe-preview.com`.

The last two origin checks remain part of the manual acceptance matrix.
