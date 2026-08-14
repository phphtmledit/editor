/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { runInNewContext } from 'node:vm';
import { describe, expect, it, vi } from 'vitest';
import {
  importDocxFile,
  MAX_DOCX_WARNING_CHARACTERS,
  MAX_DOCX_WARNINGS,
  MAX_IMPORT_BYTES,
  type DocxImportFile,
} from '../../src/io';
import type { MammothHtmlResult } from '../../src/import/mammoth-browser';
import { readBinaryFile } from '../../src/io/import-file';

const buffer = new ArrayBuffer(4);

const docxFile = (
  overrides: Partial<DocxImportFile> = {},
): DocxImportFile => ({
  name: 'document.docx',
  size: 4,
  arrayBuffer: vi.fn(async () => buffer),
  ...overrides,
});

const converterLoader = (
  result: MammothHtmlResult,
  events?: string[],
) => vi.fn(async () => {
  events?.push('load');
  return {
    convertToHtml: vi.fn(async (input: ArrayBuffer) => {
      expect(input).not.toBe(buffer);
      expect(input instanceof ArrayBuffer).toBe(true);
      expect(new Uint8Array(input)).toEqual(new Uint8Array(buffer));
      events?.push('convert');
      return result;
    }),
  };
});

const noYield = async (): Promise<void> => Promise.resolve();

describe('DOCX import', () => {
  it('copies an iframe-realm ArrayBuffer into the application realm', async () => {
    const foreignBuffer = runInNewContext('new Uint8Array([1, 2, 255]).buffer') as ArrayBuffer;
    expect(foreignBuffer instanceof ArrayBuffer).toBe(false);

    const localBuffer = await readBinaryFile({
      name: 'dropped.docx',
      size: 3,
      arrayBuffer: vi.fn(async () => foreignBuffer),
    });

    expect(localBuffer instanceof ArrayBuffer).toBe(true);
    expect(localBuffer).not.toBe(foreignBuffer);
    expect(Array.from(new Uint8Array(localBuffer))).toEqual([1, 2, 255]);
  });

  it('validates and reads before dynamically loading Mammoth at exactly 5 MiB', async () => {
    const events: string[] = [];
    const file = docxFile({
      name: 'DOCUMENT.DoCx',
      size: MAX_IMPORT_BYTES,
      arrayBuffer: vi.fn(async () => {
        events.push('read');
        return buffer;
      }),
    });
    const loadConverter = converterLoader({ value: '<p>Document</p>', messages: [] }, events);

    await expect(importDocxFile(file, { loadConverter, yieldControl: noYield }))
      .resolves.toMatchObject({ html: '<p>Document</p>' });
    expect(events).toEqual(['read', 'load', 'convert']);
  });

  it('rejects one byte over the limit without reading or loading Mammoth', async () => {
    const read = vi.fn(async () => buffer);
    const loadConverter = converterLoader({ value: '', messages: [] });
    const pending = importDocxFile(
      docxFile({ size: MAX_IMPORT_BYTES + 1, arrayBuffer: read }),
      { loadConverter, yieldControl: noYield },
    );

    await expect(pending).rejects.toMatchObject({ code: 'file-too-large' });
    expect(read).not.toHaveBeenCalled();
    expect(loadConverter).not.toHaveBeenCalled();
  });

  it('uses extension rather than MIME and rejects before loading Mammoth', async () => {
    const read = vi.fn(async () => buffer);
    const loadConverter = converterLoader({ value: '', messages: [] });
    const file = {
      ...docxFile({ name: 'document.pdf', arrayBuffer: read }),
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };

    await expect(importDocxFile(file, { loadConverter, yieldControl: noYield }))
      .rejects.toMatchObject({ code: 'unsupported-extension' });
    expect(read).not.toHaveBeenCalled();
    expect(loadConverter).not.toHaveBeenCalled();
  });

  it('runs converted HTML through the default cooperative cleaning rules', async () => {
    const loadConverter = converterLoader({
      value: '<!--note--><p class="MsoNormal" style="color:red">“Clean”</p>',
      messages: [],
    });

    const result = await importDocxFile(docxFile(), { loadConverter, yieldControl: noYield });

    expect(result.html).toBe('<p>"Clean"</p>');
  });

  it('bounds the number and length of returned Mammoth warnings', async () => {
    const longMessage = 'x'.repeat(MAX_DOCX_WARNING_CHARACTERS + 20);
    const messages = Array.from({ length: MAX_DOCX_WARNINGS + 3 }, (_, index) => ({
      type: index === 0 ? 'error' : 'warning',
      message: index === 0 ? longMessage : `warning ${index}`,
    }));
    const loadConverter = converterLoader({ value: '<p>Document</p>', messages });

    const result = await importDocxFile(docxFile(), { loadConverter, yieldControl: noYield });

    expect(result.warnings).toHaveLength(MAX_DOCX_WARNINGS);
    expect(Array.from(result.warnings[0]?.message ?? '')).toHaveLength(MAX_DOCX_WARNING_CHARACTERS);
    expect(result.warnings[0]).toMatchObject({ type: 'error', truncated: true });
    expect(result.omittedWarningCount).toBe(3);
  });

  it('maps read and conversion failures without mutating caller state', async () => {
    const loadConverter = converterLoader({ value: '', messages: [] });
    await expect(importDocxFile(docxFile({
      arrayBuffer: vi.fn(async () => { throw new Error('read failed'); }),
    }), { loadConverter, yieldControl: noYield }))
      .rejects.toMatchObject({ code: 'file-read-failed' });
    expect(loadConverter).not.toHaveBeenCalled();

    await expect(importDocxFile(docxFile(), {
      loadConverter: vi.fn(async () => { throw new Error('chunk failed'); }),
      yieldControl: noYield,
    })).rejects.toMatchObject({ code: 'docx-conversion-failed' });
  });
});
