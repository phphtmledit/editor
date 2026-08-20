/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import type { Editor, TinyMCE } from 'tinymce';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVisualEditor } from '../../src/editor/visual';

interface TinyHarness {
  readonly frameDocument: Document;
  readonly remove: ReturnType<typeof vi.fn>;
}

const LEGAL_LINKS = {
  sourceUrl: 'https://github.com/phphtmledit/editor',
  noticesUrl: '/licenses.txt',
} as const;

const installTinyHarness = (): TinyHarness => {
  const frameDocument = document.implementation.createHTMLDocument('Tiny frame');
  frameDocument.body.innerHTML = '<p>Hello <strong>world</strong></p>';
  const remove = vi.fn();
  let html = frameDocument.body.innerHTML;

  const editor = {
    getDoc: () => frameDocument,
    getBody: () => frameDocument.body,
    getContent: ({ format }: { format: string }) =>
      format === 'text' ? (frameDocument.body.textContent ?? '') : html,
    setContent: (next: string) => {
      html = next;
      frameDocument.body.innerHTML = next;
    },
    hasFocus: () => false,
    on: vi.fn(),
    off: vi.fn(),
    remove,
    selection: {
      getBookmark: () => {
        throw new Error('No selection in this unit harness');
      },
    },
    undoManager: {
      ignore: (operation: () => void) => operation(),
      reset: vi.fn(),
    },
  } as unknown as Editor;

  const tiny = {
    IconManager: {
      has: () => true,
      add: vi.fn(),
    },
    FocusManager: {
      isEditorUIElement: () => false,
    },
    init: vi.fn(async () => [editor]),
  } as unknown as TinyMCE;
  window.tinymce = tiny;
  return { frameDocument, remove };
};

const dragEvent = (
  type: string,
  files: readonly File[],
  types: readonly string[] = files.length > 0 ? ['Files'] : ['text/plain'],
): DragEvent => {
  const event = new Event(type, { bubbles: true, cancelable: true }) as DragEvent;
  Object.defineProperty(event, 'dataTransfer', {
    value: { files, types, dropEffect: 'none' },
  });
  return event;
};

afterEach(() => {
  document.body.replaceChildren();
  Reflect.deleteProperty(window, 'tinymce');
});

describe('visual editor export and iframe drop port', () => {
  it('returns TinyMCE plain text and emits a stable file snapshot for file drops', async () => {
    const harness = installTinyHarness();
    const panel = document.createElement('section');
    document.body.append(panel);
    const visual = await createVisualEditor(panel, LEGAL_LINKS);
    const listener = vi.fn();
    const unsubscribe = visual.onFileDrop(listener);
    const file = new File(['<p>import</p>'], 'document.html', { type: 'text/html' });

    expect(visual.getText()).toBe('Hello world');

    const dragover = dragEvent('dragover', [file]);
    harness.frameDocument.dispatchEvent(dragover);
    expect(dragover.defaultPrevented).toBe(true);
    expect(dragover.dataTransfer?.dropEffect).toBe('copy');

    const drop = dragEvent('drop', [file]);
    harness.frameDocument.dispatchEvent(drop);
    expect(drop.defaultPrevented).toBe(true);
    expect(listener).toHaveBeenCalledWith([file]);

    unsubscribe();
    harness.frameDocument.dispatchEvent(dragEvent('drop', [file]));
    expect(listener).toHaveBeenCalledOnce();
    visual.destroy();
    expect(harness.remove).toHaveBeenCalledOnce();
  });

  it('leaves text drags untouched', async () => {
    const harness = installTinyHarness();
    const panel = document.createElement('section');
    document.body.append(panel);
    const visual = await createVisualEditor(panel, LEGAL_LINKS);
    const listener = vi.fn();
    visual.onFileDrop(listener);

    const dragover = dragEvent('dragover', []);
    const drop = dragEvent('drop', []);
    harness.frameDocument.dispatchEvent(dragover);
    harness.frameDocument.dispatchEvent(drop);

    expect(dragover.defaultPrevented).toBe(false);
    expect(drop.defaultPrevented).toBe(false);
    expect(listener).not.toHaveBeenCalled();
    visual.destroy();
  });

  it('accepts protected-mode file dragover before File objects become readable', async () => {
    const harness = installTinyHarness();
    const panel = document.createElement('section');
    document.body.append(panel);
    const visual = await createVisualEditor(panel, LEGAL_LINKS);

    const dragover = dragEvent('dragover', [], ['Files']);
    harness.frameDocument.dispatchEvent(dragover);

    expect(dragover.defaultPrevented).toBe(true);
    expect(dragover.dataTransfer?.dropEffect).toBe('copy');
    visual.destroy();
  });
});
