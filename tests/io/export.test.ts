/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildHtmlDocument,
  createHtmlExportBlob,
  downloadHtml,
  DOWNLOAD_URL_REVOKE_DELAY_MS,
  HTML_EXPORT_MIME_TYPE,
} from '../../src/io';

describe('HTML export', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('wraps the fragment in a minimal UTF-8 HTML5 document', () => {
    const documentHtml = buildHtmlDocument('<main><p>Export</p></main>');

    expect(documentHtml).toBe(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
</head>
<body>
<main><p>Export</p></main>
</body>
</html>
`);
  });

  it('creates a typed Blob from the complete document', () => {
    const expectedDocument = buildHtmlDocument('<p>Export</p>');
    const blob = createHtmlExportBlob('<p>Export</p>');

    expect(blob.type).toBe(HTML_EXPORT_MIME_TYPE);
    expect(blob.size).toBe(new TextEncoder().encode(expectedDocument).byteLength);
  });

  it('clicks a temporary download and revokes its URL after a delay', () => {
    vi.useFakeTimers();
    const createObjectURL = vi.fn(() => 'blob:export');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { createObjectURL, revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    const blob = downloadHtml('<p>Download</p>', 'cleaned.html');

    expect(createObjectURL).toHaveBeenCalledWith(blob);
    expect(click).toHaveBeenCalledOnce();
    expect(document.querySelector('a[download="cleaned.html"]')).toBeNull();
    expect(revokeObjectURL).not.toHaveBeenCalled();

    vi.advanceTimersByTime(DOWNLOAD_URL_REVOKE_DELAY_MS);
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:export');
  });
});
