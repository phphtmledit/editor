/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export const MAX_IMPORT_BYTES = 5 * 1024 * 1024;

export type ImportFileErrorCode =
  | 'unsupported-extension'
  | 'file-too-large'
  | 'file-read-failed'
  | 'docx-conversion-failed';

export class ImportFileError extends Error {
  readonly code: ImportFileErrorCode;
  readonly cause: unknown;

  constructor(code: ImportFileErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = 'ImportFileError';
    this.code = code;
    this.cause = cause;
  }
}

export interface ImportFileMetadata {
  readonly name: string;
  readonly size: number;
}

const extensionFrom = (fileName: string): string => {
  const finalDot = fileName.lastIndexOf('.');
  if (finalDot < 0 || finalDot === fileName.length - 1) return '';
  return fileName.slice(finalDot + 1).toLowerCase();
};

export const validateImportFile = (
  file: ImportFileMetadata,
  allowedExtensions: readonly string[],
): void => {
  const extension = extensionFrom(file.name);
  if (!allowedExtensions.includes(extension)) {
    const choices = allowedExtensions.map((item) => `.${item}`).join(' or ');
    throw new ImportFileError(
      'unsupported-extension',
      `Unsupported file extension. Choose a ${choices} file.`,
    );
  }

  if (file.size > MAX_IMPORT_BYTES) {
    throw new ImportFileError(
      'file-too-large',
      'The file is larger than the 5 MiB import limit.',
    );
  }
};

export const readTextFile = async (
  file: ImportFileMetadata & Pick<File, 'text'>,
): Promise<string> => {
  try {
    return await file.text();
  } catch (error) {
    throw new ImportFileError('file-read-failed', 'The file could not be read.', error);
  }
};

export const readBinaryFile = async (
  file: ImportFileMetadata & Pick<File, 'arrayBuffer'>,
): Promise<ArrayBuffer> => {
  try {
    const foreignBuffer = await file.arrayBuffer();
    // A File dropped inside TinyMCE belongs to the iframe realm. JSZip uses a
    // parent-realm `instanceof ArrayBuffer` check, so pass it an owned copy
    // created by this realm rather than the iframe's otherwise valid buffer.
    const bytes = new Uint8Array(foreignBuffer);
    const localBytes = new Uint8Array(bytes.byteLength);
    localBytes.set(bytes);
    return localBytes.buffer;
  } catch (error) {
    throw new ImportFileError('file-read-failed', 'The file could not be read.', error);
  }
};
