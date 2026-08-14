/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { createSourceEditor, type SourceEditorController } from './editor/source';
import { createSyncController, type SyncController } from './editor/sync';
import { createVisualEditor, type VisualEditorController } from './editor/visual';
import { createMassDocumentController } from './editor/mass-document';
import { createProgrammaticMutationGuard } from './editor/mutation-guard';
import {
  createDocumentToolsController,
  type DocumentToolsController,
} from './ui/document-tools';
import { createIoToolsController, type IoToolsController } from './ui/io-tools';
import { createLayoutController, type LayoutController } from './ui/layout';
import { loadDraft } from './storage/draft';
import { appConfig } from './config';
import { applyStaticUi, STATIC_UI } from './ui/strings';
import './styles/app.css';

void appConfig;

const element = <T extends HTMLElement>(id: string): T => {
  const result = document.getElementById(id);
  if (!(result instanceof HTMLElement)) throw new Error(`Required element #${id} is missing`);
  return result as T;
};

let app: HTMLElement;
let skeleton: HTMLElement;
let status: HTMLElement;
let errorPanel: HTMLElement;
let normalizationNote: HTMLElement;
let wrapSource: HTMLInputElement;

let visual: VisualEditorController | null = null;
let source: SourceEditorController | null = null;
let sync: SyncController | null = null;
let layout: LayoutController | null = null;
let documentTools: DocumentToolsController | null = null;
let ioTools: IoToolsController | null = null;

const showNormalizationNotice = (): void => {
  normalizationNote.hidden = false;
  window.setTimeout(() => {
    normalizationNote.hidden = true;
  }, 8000);
};

const initialise = async (): Promise<void> => {
  const draftLoadResult = loadDraft();
  const visualTextarea = element<HTMLTextAreaElement>('visual-editor');
  const restoredHtml = draftLoadResult.status === 'loaded' ? draftLoadResult.draft.html : null;
  if (restoredHtml !== null) visualTextarea.value = restoredHtml;

  visual = await createVisualEditor(element('visual-panel'));
  const normalizedInitialHtml = visual.getHtml();
  const sourceInitialHtml = restoredHtml ?? normalizedInitialHtml;
  source = createSourceEditor(
    element('source-editor'),
    element<HTMLOutputElement>('character-count'),
    sourceInitialHtml,
  );
  const mutationGuard = createProgrammaticMutationGuard();
  sync = createSyncController(
    visual,
    source,
    showNormalizationNotice,
    mutationGuard,
    restoredHtml === null
      ? undefined
      : { raw: restoredHtml, normalized: normalizedInitialHtml, userAuthored: true },
  );
  const massDocument = createMassDocumentController(visual, source, mutationGuard);
  documentTools = createDocumentToolsController(source, sync, massDocument);
  ioTools = createIoToolsController(source, visual, sync, massDocument, { draftLoadResult });
  layout = createLayoutController(
    {
      workspace: element('editor-workspace'),
      visualPanel: element('visual-panel'),
      sourcePanel: element('source-panel'),
      splitter: element('editor-splitter'),
      tabs: element('visual-tab').parentElement ?? element('visual-tab'),
      visualTab: element<HTMLButtonElement>('visual-tab'),
      sourceTab: element<HTMLButtonElement>('source-tab'),
    },
    source,
    sync,
    visual,
  );

  wrapSource.addEventListener('change', () => source?.setLineWrapping(wrapSource.checked));
  skeleton.hidden = true;
  app.setAttribute('aria-busy', 'false');
  status.textContent = STATIC_UI.appStatusReady;
};

const destroy = (): void => {
  ioTools?.destroy();
  documentTools?.destroy();
  layout?.destroy();
  sync?.destroy();
  source?.destroy();
  visual?.destroy();
};

const waitForInitialPaint = (): Promise<void> => new Promise((resolve) => {
  requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
});

const showFatalError = (error: unknown): void => {
  console.error('Editor initialisation failed', error);
  const shell = document.getElementById('app');
  const loading = document.getElementById('loading-skeleton');
  const errorElement = document.getElementById('app-error');
  const statusElement = document.getElementById('app-status');
  if (loading instanceof HTMLElement) loading.hidden = true;
  if (errorElement instanceof HTMLElement) {
    errorElement.classList.remove('bootstrap-fallback');
    errorElement.hidden = false;
  }
  if (shell instanceof HTMLElement) {
    shell.classList.add('has-fatal-error');
    shell.setAttribute('aria-busy', 'false');
  }
  if (statusElement instanceof HTMLElement) statusElement.textContent = STATIC_UI.appStatusFailed;
};

try {
  applyStaticUi();
  app = element<HTMLElement>('app');
  skeleton = element<HTMLElement>('loading-skeleton');
  status = element<HTMLElement>('app-status');
  errorPanel = element<HTMLElement>('app-error');
  normalizationNote = element<HTMLElement>('normalization-note');
  wrapSource = element<HTMLInputElement>('wrap-source');
  errorPanel.hidden = true;
  errorPanel.classList.remove('bootstrap-fallback');

  window.addEventListener('pagehide', (event: PageTransitionEvent) => {
    if (event.persisted) {
      ioTools?.saveDraftNow();
      return;
    }
    ioTools?.saveDraftFinal();
    destroy();
  });

  void waitForInitialPaint().then(initialise).catch(showFatalError);
} catch (error: unknown) {
  showFatalError(error);
}
