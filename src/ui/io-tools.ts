/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import type { MassDocumentController } from '../editor/mass-document';
import type { SourceEditorController } from '../editor/source';
import type { SyncController } from '../editor/sync';
import type { VisualEditorController } from '../editor/visual';
import {
  copyHtmlToClipboard,
  copyTextToClipboard,
  downloadHtml,
  importDocxFile,
  importHtmlFile,
  ImportFileError,
  type DocxImportResult,
} from '../io';
import {
  createDraftAutosave,
  type DraftAutosaveController,
  type DraftLoadResult,
  type DraftSaveResult,
} from '../storage/draft';
import { IO_UI, SAMPLE_HTML, ioMessage } from './strings';

type IoSourcePort = Pick<SourceEditorController, 'getHtml'>;
type IoVisualPort = Pick<VisualEditorController, 'getHtml' | 'getText' | 'onFileDrop'>;
type IoSyncPort = Pick<SyncController, 'flushActive'>;
type IoMassPort = Pick<MassDocumentController, 'apply'>;

interface IoOperations {
  importHtml: typeof importHtmlFile;
  importDocx: typeof importDocxFile;
  download: typeof downloadHtml;
  copyHtml: typeof copyHtmlToClipboard;
  copyText: typeof copyTextToClipboard;
}

export interface IoToolsOptions {
  readonly draftLoadResult: DraftLoadResult;
  readonly document?: Document;
  readonly window?: Window;
  readonly operations?: Partial<IoOperations>;
  readonly confirmNewDocument?: () => boolean;
}

export interface IoToolsController {
  readonly saveDraftNow: () => DraftSaveResult;
  readonly saveDraftFinal: () => DraftSaveResult;
  readonly destroy: () => void;
}

const element = <T extends HTMLElement>(document: Document, id: string): T => {
  const result = document.getElementById(id);
  if (!(result instanceof HTMLElement)) throw new Error(`Required element #${id} is missing`);
  return result as T;
};

const extension = (fileName: string): string => {
  const dot = fileName.lastIndexOf('.');
  return dot < 0 ? '' : fileName.slice(dot + 1).toLowerCase();
};

const nextPaint = (window: Window): Promise<void> => new Promise((resolve) => {
  window.requestAnimationFrame(() => window.requestAnimationFrame(() => resolve()));
});

export const createIoToolsController = (
  source: IoSourcePort,
  visual: IoVisualPort,
  sync: IoSyncPort,
  massDocument: IoMassPort,
  options: IoToolsOptions,
): IoToolsController => {
  const document = options.document ?? globalThis.document;
  const window = options.window ?? globalThis.window;
  const operations: IoOperations = {
    importHtml: options.operations?.importHtml ?? importHtmlFile,
    importDocx: options.operations?.importDocx ?? importDocxFile,
    download: options.operations?.download ?? downloadHtml,
    copyHtml: options.operations?.copyHtml ?? copyHtmlToClipboard,
    copyText: options.operations?.copyText ?? copyTextToClipboard,
  };

  const tools = element<HTMLElement>(document, 'io-tools');
  const workspace = element<HTMLElement>(document, 'editor-workspace');
  const fileInput = element<HTMLInputElement>(document, 'import-file-input');
  const chooseFile = element<HTMLButtonElement>(document, 'choose-import-file');
  const exportButton = element<HTMLButtonElement>(document, 'export-html');
  const copyHtmlButton = element<HTMLButtonElement>(document, 'copy-html');
  const copyTextButton = element<HTMLButtonElement>(document, 'copy-text');
  const sampleButton = element<HTMLButtonElement>(document, 'load-example');
  const newButton = element<HTMLButtonElement>(document, 'new-document');
  const result = element<HTMLOutputElement>(document, 'io-result');
  const draftNotice = element<HTMLElement>(document, 'draft-notice');
  const draftMessage = element<HTMLElement>(document, 'draft-message');
  const discardDraftButton = element<HTMLButtonElement>(document, 'discard-restored-draft');
  const actionButtons = [chooseFile, exportButton, copyHtmlButton, copyTextButton, sampleButton, newButton];
  const removers: Array<() => void> = [];
  let destroyed = false;
  let busy = false;
  let restoredNoticeActive = options.draftLoadResult.status === 'loaded';

  const showDraftNotice = (message: string, showDiscard: boolean): void => {
    draftMessage.textContent = message;
    discardDraftButton.hidden = !showDiscard;
    draftNotice.hidden = false;
  };

  const hideDraftNotice = (): void => {
    draftNotice.hidden = true;
    restoredNoticeActive = false;
  };

  const handleDraftResult = (saveResult: DraftSaveResult): void => {
    if (saveResult.status === 'too-large') {
      restoredNoticeActive = false;
      showDraftNotice(IO_UI.draftTooLarge, false);
      return;
    }
    if (saveResult.status === 'storage-error' || saveResult.status === 'source-error') {
      restoredNoticeActive = false;
      showDraftNotice(IO_UI.draftSaveFailed, false);
      return;
    }
    if (!restoredNoticeActive && !draftNotice.hidden) draftNotice.hidden = true;
  };

  const restoredHtml = options.draftLoadResult.status === 'loaded'
    ? options.draftLoadResult.draft.html
    : undefined;
  const initialSavedHtml = options.draftLoadResult.status === 'empty'
    ? source.getHtml()
    : restoredHtml;
  const draftAutosave: DraftAutosaveController = createDraftAutosave({
    getHtml: () => {
      sync.flushActive();
      return source.getHtml();
    },
    // A missing draft and a restored draft are already represented by the
    // current source. Invalid/oversized records are not: leave the seed
    // undefined so the first autosave replaces the unusable stored value.
    initialSavedHtml,
    onResult: handleDraftResult,
  });

  if (options.draftLoadResult.status === 'loaded') {
    showDraftNotice(ioMessage.restoredDraft(options.draftLoadResult.draft.savedAt), true);
  } else if (options.draftLoadResult.status === 'too-large') {
    showDraftNotice(IO_UI.storedDraftTooLarge, false);
  } else if (options.draftLoadResult.status === 'invalid') {
    showDraftNotice(IO_UI.storedDraftInvalid, false);
  } else if (options.draftLoadResult.status === 'storage-error') {
    showDraftNotice(IO_UI.draftStorageUnavailable, false);
  }

  const setBusy = (next: boolean): void => {
    busy = next;
    tools.setAttribute('aria-busy', String(next));
    actionButtons.forEach((button) => { button.disabled = next; });
  };

  const currentSnapshot = (): string => {
    sync.flushActive();
    return source.getHtml();
  };

  const snapshotIsCurrent = (snapshot: string): boolean => {
    sync.flushActive();
    if (source.getHtml() === snapshot) return true;
    result.textContent = IO_UI.staleOperation;
    return false;
  };

  const applyMass = (label: string, nextHtml: string, snapshot: string): void => {
    if (nextHtml === snapshot) {
      result.textContent = IO_UI.alreadyContainsData;
      return;
    }
    massDocument.apply(label, nextHtml, snapshot);
  };

  const importFiles = async (files: readonly File[]): Promise<void> => {
    if (busy || destroyed) return;
    if (files.length !== 1) {
      result.textContent = files.length === 0
        ? IO_UI.selectImportFile
        : IO_UI.importOneFile;
      return;
    }

    const file = files[0];
    if (!file) return;
    const snapshot = currentSnapshot();
    setBusy(true);
    result.textContent = extension(file.name) === 'docx'
      ? ioMessage.parsingFile(file.name)
      : ioMessage.openingFile(file.name);

    try {
      await nextPaint(window);
      let html: string;
      let docxResult: DocxImportResult | null = null;
      const fileExtension = extension(file.name);
      if (fileExtension === 'html' || fileExtension === 'htm') {
        html = await operations.importHtml(file);
      } else {
        docxResult = await operations.importDocx(file);
        html = docxResult.html;
      }
      if (!snapshotIsCurrent(snapshot)) return;
      applyMass(ioMessage.importMassLabel(file.name), html, snapshot);
      if (docxResult) {
        const warningCount = docxResult.warnings.length + docxResult.omittedWarningCount;
        result.textContent = ioMessage.docxImported(file.name, warningCount);
      } else {
        result.textContent = ioMessage.htmlImported(file.name);
      }
    } catch (error: unknown) {
      result.textContent = ioMessage.importError(
        error instanceof ImportFileError ? error.code : undefined,
      );
    } finally {
      fileInput.value = '';
      setBusy(false);
    }
  };

  const add = <K extends keyof HTMLElementEventMap>(
    target: HTMLElement,
    type: K,
    listener: (event: HTMLElementEventMap[K]) => void,
  ): void => {
    target.addEventListener(type, listener as EventListener);
    removers.push(() => target.removeEventListener(type, listener as EventListener));
  };

  add(chooseFile, 'click', () => fileInput.click());
  add(fileInput, 'change', () => { void importFiles(Array.from(fileInput.files ?? [])); });
  add(exportButton, 'click', () => {
    try {
      sync.flushActive();
      operations.download(visual.getHtml());
      result.textContent = IO_UI.htmlDownloadReady;
    } catch {
      result.textContent = IO_UI.htmlDownloadFailed;
    }
  });
  add(copyHtmlButton, 'click', () => {
    sync.flushActive();
    const copy = operations.copyHtml(visual.getHtml());
    void copy
      .then((copyResult) => {
        result.textContent = ioMessage.clipboard(
          'html',
          copyResult.ok ? copyResult.method : 'failed',
        );
      })
      .catch(() => { result.textContent = ioMessage.clipboard('html', 'failed'); });
  });
  add(copyTextButton, 'click', () => {
    sync.flushActive();
    const copy = operations.copyText(visual.getText());
    void copy
      .then((copyResult) => {
        result.textContent = ioMessage.clipboard(
          'text',
          copyResult.ok ? copyResult.method : 'failed',
        );
      })
      .catch(() => { result.textContent = ioMessage.clipboard('text', 'failed'); });
  });
  add(sampleButton, 'click', () => {
    const snapshot = currentSnapshot();
    applyMass(IO_UI.sampleMassLabel, SAMPLE_HTML, snapshot);
    result.textContent = IO_UI.sampleLoaded;
  });

  const startNew = (confirm: boolean): void => {
    if (confirm && !(options.confirmNewDocument ?? (() => window.confirm(IO_UI.confirmNewDocument)))()) return;
    const snapshot = currentSnapshot();
    applyMass(IO_UI.newDocumentMassLabel, '', snapshot);
    hideDraftNotice();
    draftAutosave.saveNow();
    result.textContent = IO_UI.newDocumentCreated;
  };
  add(newButton, 'click', () => startNew(true));
  add(discardDraftButton, 'click', () => startNew(false));

  const hasFilePayload = (event: DragEvent): boolean => {
    const transfer = event.dataTransfer;
    if (!transfer) return false;
    return transfer.files.length > 0 || Array.from(transfer.types).includes('Files');
  };
  const onWorkspaceDragOver = (event: DragEvent): void => {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    workspace.classList.add('is-file-dragover');
  };
  const onWorkspaceDragLeave = (event: DragEvent): void => {
    if (event.relatedTarget instanceof Node && workspace.contains(event.relatedTarget)) return;
    workspace.classList.remove('is-file-dragover');
  };
  const onWorkspaceDrop = (event: DragEvent): void => {
    if (!hasFilePayload(event)) return;
    event.preventDefault();
    workspace.classList.remove('is-file-dragover');
    void importFiles(Array.from(event.dataTransfer?.files ?? []));
  };
  workspace.addEventListener('dragover', onWorkspaceDragOver);
  workspace.addEventListener('dragleave', onWorkspaceDragLeave);
  workspace.addEventListener('drop', onWorkspaceDrop);
  removers.push(
    () => workspace.removeEventListener('dragover', onWorkspaceDragOver),
    () => workspace.removeEventListener('dragleave', onWorkspaceDragLeave),
    () => workspace.removeEventListener('drop', onWorkspaceDrop),
    visual.onFileDrop((files) => { void importFiles(files); }),
  );

  draftAutosave.start();

  return {
    saveDraftNow: draftAutosave.saveNow,
    saveDraftFinal: draftAutosave.saveFinal,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      draftAutosave.stop();
      removers.forEach((remove) => remove());
      workspace.classList.remove('is-file-dragover');
    },
  };
};
