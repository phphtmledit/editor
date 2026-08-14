/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { readTextFile, validateImportFile } from './import-file';

export type HtmlImportFile = Pick<File, 'name' | 'size' | 'text'>;

const HTML_FILE_EXTENSIONS = ['html', 'htm'] as const;
const FULL_HTML_DOCUMENT_MARKER =
  /(?:<!doctype\s+html(?:\s|>)|<html(?:\s|>)|<head(?:\s|>)|<body(?:\s|>))/i;

/**
 * Full documents are reduced to the editable body fragment. Files that already
 * contain a fragment remain byte-for-byte untouched until TinyMCE receives it.
 */
export const extractEditableHtml = (source: string): string => {
  if (!FULL_HTML_DOCUMENT_MARKER.test(source)) return source;
  return new DOMParser().parseFromString(source, 'text/html').body.innerHTML;
};

export const importHtmlFile = async (file: HtmlImportFile): Promise<string> => {
  validateImportFile(file, HTML_FILE_EXTENSIONS);
  return extractEditableHtml(await readTextFile(file));
};
