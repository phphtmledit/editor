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
  type ClipboardCopyResult,
  type DocxImportResult,
} from '../io';
import {
  createDraftAutosave,
  type DraftAutosaveController,
  type DraftLoadResult,
  type DraftSaveResult,
} from '../storage/draft';

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

const SAMPLE_HTML = `<!-- Лишний комментарий для проверки очистки -->
<h1 class="generated-title" style="color: #4f46e5">Пример грязного HTML</h1>
<p style="font-family: Arial">Этот&nbsp;&nbsp;&nbsp;текст содержит   повторные пробелы, “кавычки”,
нулевой&#8203;символ и <span class="temporary-mark">лишние классы</span>.</p>
<p><strong>Попробуйте</strong> правила очистки, форматирование и массовую отмену.</p>`;

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

const importErrorMessage = (error: unknown): string => {
  if (error instanceof ImportFileError) {
    if (error.code === 'unsupported-extension') return 'Поддерживаются только файлы .html, .htm и .docx.';
    if (error.code === 'file-too-large') return 'Файл превышает ограничение 5 МБ.';
    if (error.code === 'file-read-failed') return 'Не удалось прочитать выбранный файл.';
    if (error.code === 'docx-conversion-failed') return 'Не удалось разобрать документ DOCX.';
  }
  return 'Импорт не выполнен. Файл повреждён или имеет неподдерживаемый формат.';
};

const clipboardMessage = (kind: 'HTML' | 'Текст', result: ClipboardCopyResult): string => {
  if (!result.ok) return `${kind} не скопирован: браузер запретил доступ к буферу обмена.`;
  return result.method === 'clipboard-api'
    ? `${kind} скопирован в буфер обмена.`
    : `${kind} скопирован резервным способом.`;
};

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
      showDraftNotice('Черновик больше 1 МБ. Последняя допустимая версия сохранена, автосохранение возобновится после уменьшения документа.', false);
      return;
    }
    if (saveResult.status === 'storage-error' || saveResult.status === 'source-error') {
      restoredNoticeActive = false;
      showDraftNotice('Не удалось сохранить черновик в этом браузере.', false);
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
    const savedAt = new Date(options.draftLoadResult.draft.savedAt).toLocaleString('ru-RU');
    showDraftNotice(`Восстановлен локальный черновик от ${savedAt}.`, true);
  } else if (options.draftLoadResult.status === 'too-large') {
    showDraftNotice('Сохранённый черновик превышает 1 МБ и не был восстановлен.', false);
  } else if (options.draftLoadResult.status === 'invalid') {
    showDraftNotice('Сохранённый черновик повреждён и не был восстановлен.', false);
  } else if (options.draftLoadResult.status === 'storage-error') {
    showDraftNotice('Локальное хранилище недоступно; черновик сохраняться не будет.', false);
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
    result.textContent = 'Документ изменился во время операции. Полученный результат не применён.';
    return false;
  };

  const applyMass = (label: string, nextHtml: string, snapshot: string): void => {
    if (nextHtml === snapshot) {
      result.textContent = 'Документ уже содержит эти данные.';
      return;
    }
    massDocument.apply(label, nextHtml, snapshot);
  };

  const importFiles = async (files: readonly File[]): Promise<void> => {
    if (busy || destroyed) return;
    if (files.length !== 1) {
      result.textContent = files.length === 0
        ? 'Выберите файл для импорта.'
        : 'Импортируйте по одному файлу за раз.';
      return;
    }

    const file = files[0];
    if (!file) return;
    const snapshot = currentSnapshot();
    setBusy(true);
    result.textContent = extension(file.name) === 'docx'
      ? `Разбираем ${file.name}…`
      : `Открываем ${file.name}…`;

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
      applyMass(`импорт ${file.name}`, html, snapshot);
      if (docxResult) {
        const warningCount = docxResult.warnings.length + docxResult.omittedWarningCount;
        result.textContent = warningCount === 0
          ? `Документ ${file.name} импортирован без предупреждений.`
          : `Документ ${file.name} импортирован. Предупреждений: ${warningCount}.`;
      } else {
        result.textContent = `Файл ${file.name} импортирован.`;
      }
    } catch (error: unknown) {
      result.textContent = importErrorMessage(error);
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
      result.textContent = 'HTML-файл подготовлен для скачивания.';
    } catch {
      result.textContent = 'Не удалось скачать HTML-файл.';
    }
  });
  add(copyHtmlButton, 'click', () => {
    sync.flushActive();
    const copy = operations.copyHtml(visual.getHtml());
    void copy
      .then((copyResult) => { result.textContent = clipboardMessage('HTML', copyResult); })
      .catch(() => { result.textContent = 'HTML не скопирован: браузер запретил доступ к буферу обмена.'; });
  });
  add(copyTextButton, 'click', () => {
    sync.flushActive();
    const copy = operations.copyText(visual.getText());
    void copy
      .then((copyResult) => { result.textContent = clipboardMessage('Текст', copyResult); })
      .catch(() => { result.textContent = 'Текст не скопирован: браузер запретил доступ к буферу обмена.'; });
  });
  add(sampleButton, 'click', () => {
    const snapshot = currentSnapshot();
    applyMass('загрузка примера', SAMPLE_HTML, snapshot);
    result.textContent = 'Загружен демонстрационный документ.';
  });

  const startNew = (confirm: boolean): void => {
    if (confirm && !(options.confirmNewDocument ?? (() => window.confirm('Очистить документ? Несохранённые изменения останутся только в истории массовых операций.')))()) return;
    const snapshot = currentSnapshot();
    applyMass('новый документ', '', snapshot);
    hideDraftNotice();
    draftAutosave.saveNow();
    result.textContent = 'Создан новый документ.';
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
