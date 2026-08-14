/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export const HTML_EXPORT_MIME_TYPE = 'text/html;charset=utf-8';
export const DOWNLOAD_URL_REVOKE_DELAY_MS = 1_000;

export const buildHtmlDocument = (htmlFragment: string): string => `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
${htmlFragment}
</body>
</html>
`;

export const createHtmlExportBlob = (htmlFragment: string): Blob =>
  new Blob([buildHtmlDocument(htmlFragment)], { type: HTML_EXPORT_MIME_TYPE });

export const downloadHtml = (
  htmlFragment: string,
  fileName = 'document.html',
): Blob => {
  const blob = createHtmlExportBlob(htmlFragment);
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = fileName;
  anchor.style.display = 'none';

  try {
    (document.body ?? document.documentElement).append(anchor);
    anchor.click();
  } finally {
    anchor.remove();
    globalThis.setTimeout(() => URL.revokeObjectURL(objectUrl), DOWNLOAD_URL_REVOKE_DELAY_MS);
  }

  return blob;
};
