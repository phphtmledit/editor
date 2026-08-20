/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import type { Editor, RawEditorOptions, TinyMCE } from 'tinymce';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createVisualEditor, type VisualEditorController } from '../../src/editor/visual';
import { VISUAL_UI } from '../../src/ui/strings';

interface RegisteredMenuItem {
  readonly text?: string;
  readonly onAction?: () => void;
}

interface TinyHarness {
  readonly init: ReturnType<typeof vi.fn>;
  readonly initOptions: RawEditorOptions[];
  readonly menuItems: Map<string, RegisteredMenuItem>;
}

const SOURCE_URL = 'https://code.example.test/phphtmledit/editor?ref=menu';
const NOTICES_URL = '/legal/notices.txt?v=2';

const installTinyHarness = (): TinyHarness => {
  const frameDocument = document.implementation.createHTMLDocument('Tiny frame');
  frameDocument.body.innerHTML = '<p>Menu test</p>';
  const menuItems = new Map<string, RegisteredMenuItem>();
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
    remove: vi.fn(),
    selection: {
      getBookmark: () => {
        throw new Error('No selection in this unit harness');
      },
    },
    undoManager: {
      ignore: (operation: () => void) => operation(),
      reset: vi.fn(),
    },
    ui: {
      registry: {
        addMenuItem: (name: string, spec: RegisteredMenuItem) => menuItems.set(name, spec),
      },
    },
  } as unknown as Editor;

  const initOptions: RawEditorOptions[] = [];
  const init = vi.fn(async (options: RawEditorOptions) => {
    initOptions.push(options);
    options.setup?.(editor);
    return [editor];
  });
  window.tinymce = {
    IconManager: {
      has: () => true,
      add: vi.fn(),
    },
    FocusManager: {
      isEditorUIElement: () => false,
    },
    init,
  } as unknown as TinyMCE;

  return { init, initOptions, menuItems };
};

const createAboutEditor = async (): Promise<{
  readonly controller: VisualEditorController;
  readonly harness: TinyHarness;
}> => {
  const harness = installTinyHarness();
  const panel = document.createElement('section');
  document.body.append(panel);
  const controller = await createVisualEditor(panel, {
    sourceUrl: SOURCE_URL,
    noticesUrl: NOTICES_URL,
  });
  return { controller, harness };
};

afterEach(() => {
  document.body.replaceChildren();
  Reflect.deleteProperty(window, 'tinymce');
  vi.restoreAllMocks();
});

describe('TinyMCE About menu', () => {
  it('registers one top-level About menu containing exactly the two legal links', async () => {
    const { controller, harness } = await createAboutEditor();
    const options = harness.initOptions[0];

    expect(options).toBeDefined();
    expect(options?.menubar?.toString().split(/\s+/)).toContain('about');
    expect(options?.menu?.about).toEqual({
      title: VISUAL_UI.aboutMenu,
      items: 'phesourcecode phethirdpartynotices',
    });
    expect([...harness.menuItems.keys()]).toEqual([
      'phesourcecode',
      'phethirdpartynotices',
    ]);
    expect([...harness.menuItems.values()].map((item) => item.text)).toEqual([
      VISUAL_UI.sourceCode,
      VISUAL_UI.thirdPartyNotices,
    ]);

    controller.destroy();
  });

  it('opens each configured URL exactly once through a removed noopener anchor', async () => {
    const { controller, harness } = await createAboutEditor();
    const clicks: Array<{ readonly anchor: HTMLAnchorElement; readonly wasConnected: boolean }> = [];
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function () {
      clicks.push({ anchor: this, wasConnected: this.isConnected });
    });

    harness.menuItems.get('phesourcecode')?.onAction?.();
    harness.menuItems.get('phethirdpartynotices')?.onAction?.();

    expect(click).toHaveBeenCalledTimes(2);
    expect(clicks.map(({ anchor }) => anchor.getAttribute('href'))).toEqual([
      SOURCE_URL,
      NOTICES_URL,
    ]);
    for (const { anchor, wasConnected } of clicks) {
      expect(wasConnected).toBe(true);
      expect(anchor.getAttribute('target')).toBe('_blank');
      expect(anchor.getAttribute('rel')).toBe('noopener noreferrer');
      expect(anchor.isConnected).toBe(false);
    }
    expect(document.body.querySelector('a')).toBeNull();

    controller.destroy();
  });

  it('removes the temporary anchor even when native activation fails', async () => {
    const { controller, harness } = await createAboutEditor();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      throw new Error('Synthetic navigation failure');
    });

    expect(() => harness.menuItems.get('phesourcecode')?.onAction?.())
      .toThrow('Synthetic navigation failure');
    expect(document.body.querySelector('a')).toBeNull();

    controller.destroy();
  });

  it.each([
    ['javascript:alert(1)', NOTICES_URL, 'source-code'],
    [SOURCE_URL, 'data:text/plain,notices', 'notices'],
  ])('rejects unsafe direct link configuration before TinyMCE initialises', async (
    sourceUrl,
    noticesUrl,
    expectedLabel,
  ) => {
    const harness = installTinyHarness();
    const panel = document.createElement('section');
    document.body.append(panel);

    await expect(createVisualEditor(panel, { sourceUrl, noticesUrl }))
      .rejects.toThrow(expectedLabel);
    expect(harness.init).not.toHaveBeenCalled();
  });
});
