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
import { createLayoutController, type LayoutController } from './ui/layout';
import './styles/app.css';

const element = <T extends HTMLElement>(id: string): T => {
  const result = document.getElementById(id);
  if (!(result instanceof HTMLElement)) throw new Error(`Required element #${id} is missing`);
  return result as T;
};

const app = element<HTMLElement>('app');
const skeleton = element<HTMLElement>('loading-skeleton');
const status = element<HTMLElement>('app-status');
const errorPanel = element<HTMLElement>('app-error');
const normalizationNote = element<HTMLElement>('normalization-note');
const wrapSource = element<HTMLInputElement>('wrap-source');

let visual: VisualEditorController | null = null;
let source: SourceEditorController | null = null;
let sync: SyncController | null = null;
let layout: LayoutController | null = null;
let documentTools: DocumentToolsController | null = null;

const showNormalizationNotice = (): void => {
  normalizationNote.hidden = false;
  window.setTimeout(() => {
    normalizationNote.hidden = true;
  }, 8000);
};

const initialise = async (): Promise<void> => {
  visual = await createVisualEditor(element('visual-panel'));
  source = createSourceEditor(
    element('source-editor'),
    element<HTMLOutputElement>('character-count'),
    visual.getHtml(),
  );
  const mutationGuard = createProgrammaticMutationGuard();
  sync = createSyncController(visual, source, showNormalizationNotice, mutationGuard);
  const massDocument = createMassDocumentController(visual, source, mutationGuard);
  documentTools = createDocumentToolsController(source, sync, massDocument);
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
  );

  wrapSource.addEventListener('change', () => source?.setLineWrapping(wrapSource.checked));
  skeleton.hidden = true;
  app.setAttribute('aria-busy', 'false');
  status.textContent = 'Редакторы готовы.';
};

const destroy = (): void => {
  documentTools?.destroy();
  layout?.destroy();
  sync?.destroy();
  source?.destroy();
  visual?.destroy();
};

window.addEventListener('pagehide', (event: PageTransitionEvent) => {
  if (!event.persisted) destroy();
});

void initialise().catch((error: unknown) => {
  console.error('Editor initialisation failed', error);
  skeleton.hidden = true;
  errorPanel.hidden = false;
  app.setAttribute('aria-busy', 'false');
  status.textContent = 'Редактор не загрузился.';
});
