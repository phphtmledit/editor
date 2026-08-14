/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { describe, expect, it, vi } from 'vitest';
import {
  extractEditableHtml,
  importHtmlFile,
  ImportFileError,
  MAX_IMPORT_BYTES,
  type HtmlImportFile,
} from '../../src/io';

const htmlFile = (
  overrides: Partial<HtmlImportFile> = {},
): HtmlImportFile => ({
  name: 'document.html',
  size: 12,
  text: vi.fn(async () => '<p>fragment</p>'),
  ...overrides,
});

describe('HTML import', () => {
  it('accepts a case-insensitive HTML extension regardless of MIME metadata', async () => {
    const file = {
      ...htmlFile({ name: 'document.HTM' }),
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    await expect(importHtmlFile(file)).resolves.toBe('<p>fragment</p>');
  });

  it('accepts a file exactly at the 5 MiB boundary', async () => {
    const read = vi.fn(async () => '<p>limit</p>');

    await expect(importHtmlFile(htmlFile({ size: MAX_IMPORT_BYTES, text: read })))
      .resolves.toBe('<p>limit</p>');
    expect(read).toHaveBeenCalledOnce();
  });

  it('rejects one byte over 5 MiB before reading', async () => {
    const read = vi.fn(async () => '<p>too large</p>');
    const pending = importHtmlFile(htmlFile({ size: MAX_IMPORT_BYTES + 1, text: read }));

    await expect(pending).rejects.toMatchObject({ code: 'file-too-large' });
    expect(read).not.toHaveBeenCalled();
  });

  it('rejects a MIME-matched file when its extension is unsupported', async () => {
    const read = vi.fn(async () => '<p>wrong extension</p>');
    const file = { ...htmlFile({ name: 'document.txt', text: read }), type: 'text/html' };

    await expect(importHtmlFile(file)).rejects.toMatchObject({
      code: 'unsupported-extension',
    });
    expect(read).not.toHaveBeenCalled();
  });

  it('extracts body markup from a full HTML document', () => {
    const fullDocument = '<!doctype html><html><head><title>Ignore</title></head>'
      + '<body><main><p>Keep</p></main></body></html>';

    expect(extractEditableHtml(fullDocument)).toBe('<main><p>Keep</p></main>');
  });

  it('retains an existing fragment byte-for-byte', () => {
    const fragment = "  <p data-note='raw'>Keep &amp; edit</p>\n";

    expect(extractEditableHtml(fragment)).toBe(fragment);
  });

  it('maps file-reading failures to a stable error code', async () => {
    const pending = importHtmlFile(htmlFile({
      text: vi.fn(async () => { throw new Error('device error'); }),
    }));

    await expect(pending).rejects.toBeInstanceOf(ImportFileError);
    await expect(pending).rejects.toMatchObject({ code: 'file-read-failed' });
  });
});
