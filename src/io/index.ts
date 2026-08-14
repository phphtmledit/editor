/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export { copyHtmlToClipboard, copyTextToClipboard } from './clipboard';
export type { ClipboardCopyResult } from './clipboard';
export {
  buildHtmlDocument,
  createHtmlExportBlob,
  downloadHtml,
  DOWNLOAD_URL_REVOKE_DELAY_MS,
  HTML_EXPORT_MIME_TYPE,
} from './export';
export {
  importDocxFile,
  MAX_DOCX_WARNING_CHARACTERS,
  MAX_DOCX_WARNINGS,
} from './import-docx';
export type {
  DocxImportDependencies,
  DocxImportFile,
  DocxImportResult,
  DocxImportWarning,
} from './import-docx';
export { extractEditableHtml, importHtmlFile } from './import-html';
export type { HtmlImportFile } from './import-html';
export { ImportFileError, MAX_IMPORT_BYTES } from './import-file';
export type { ImportFileErrorCode, ImportFileMetadata } from './import-file';
