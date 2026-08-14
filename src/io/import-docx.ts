/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { cleanHtmlCooperatively, type CleanYield } from '../clean';
import type { MammothHtmlResult } from '../import/mammoth-browser';
import {
  ImportFileError,
  readBinaryFile,
  validateImportFile,
} from './import-file';

export const MAX_DOCX_WARNINGS = 10;
export const MAX_DOCX_WARNING_CHARACTERS = 500;

export type DocxImportFile = Pick<File, 'name' | 'size' | 'arrayBuffer'>;

export interface DocxImportWarning {
  readonly type: 'warning' | 'error';
  readonly message: string;
  readonly truncated: boolean;
}

export interface DocxImportResult {
  readonly html: string;
  readonly warnings: readonly DocxImportWarning[];
  readonly omittedWarningCount: number;
}

interface MammothConverterModule {
  convertToHtml(arrayBuffer: ArrayBuffer): Promise<MammothHtmlResult>;
}

export interface DocxImportDependencies {
  /** Test seam; production deliberately uses the dynamic import below. */
  readonly loadConverter?: () => Promise<MammothConverterModule>;
  readonly yieldControl?: CleanYield;
}

const loadMammothConverter = (): Promise<MammothConverterModule> =>
  import('../import/mammoth-browser');

const boundWarningMessage = (
  message: string,
): { readonly message: string; readonly truncated: boolean } => {
  const characters = Array.from(message);
  if (characters.length <= MAX_DOCX_WARNING_CHARACTERS) {
    return { message, truncated: false };
  }
  return {
    message: `${characters.slice(0, MAX_DOCX_WARNING_CHARACTERS - 1).join('')}…`,
    truncated: true,
  };
};

const boundWarnings = (
  messages: MammothHtmlResult['messages'],
): Pick<DocxImportResult, 'warnings' | 'omittedWarningCount'> => ({
  warnings: messages.slice(0, MAX_DOCX_WARNINGS).map((message) => ({
    type: message.type === 'error' ? 'error' : 'warning',
    ...boundWarningMessage(message.message),
  })),
  omittedWarningCount: Math.max(0, messages.length - MAX_DOCX_WARNINGS),
});

export const importDocxFile = async (
  file: DocxImportFile,
  dependencies: DocxImportDependencies = {},
): Promise<DocxImportResult> => {
  validateImportFile(file, ['docx']);

  // Reading completes before the lazy Mammoth chunk is requested. Invalid or
  // unreadable files therefore do not add its weight to the session.
  const arrayBuffer = await readBinaryFile(file);
  const loadConverter = dependencies.loadConverter ?? loadMammothConverter;

  let converted: MammothHtmlResult;
  try {
    const converter = await loadConverter();
    converted = await converter.convertToHtml(arrayBuffer);
  } catch (error) {
    throw new ImportFileError(
      'docx-conversion-failed',
      'The DOCX file could not be converted to HTML.',
      error,
    );
  }

  const cleaned = await cleanHtmlCooperatively(
    converted.value,
    undefined,
    dependencies.yieldControl,
  );
  return {
    html: cleaned.html,
    ...boundWarnings(converted.messages),
  };
};
