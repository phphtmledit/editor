import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ImportFileError, MAX_IMPORT_BYTES } from '../../src/io';
import { DRAFT_AUTOSAVE_INTERVAL_MS, DRAFT_STORAGE_KEY } from '../../src/storage/draft';
import {
  createIoToolsController,
  type IoToolsController,
  type IoToolsOptions,
} from '../../src/ui/io-tools';

const markup = `
  <section id="io-tools" aria-busy="false">
    <input id="import-file-input" type="file" hidden />
    <button id="choose-import-file" type="button">Open</button>
    <button id="export-html" type="button">Export</button>
    <button id="copy-html" type="button">Copy HTML</button>
    <button id="copy-text" type="button">Copy text</button>
    <button id="load-example" type="button">Sample</button>
    <button id="new-document" type="button">New</button>
    <output id="io-result"></output>
    <aside id="draft-notice" hidden>
      <span id="draft-message"></span>
      <button id="discard-restored-draft" type="button">Start new</button>
    </aside>
  </section>
  <section id="editor-workspace"></section>
`;

interface Deferred<T> {
  readonly promise: Promise<T>;
  readonly resolve: (value: T) => void;
}

const deferred = <T>(): Deferred<T> => {
  let resolvePromise!: (value: T) => void;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: resolvePromise };
};

const settle = async (): Promise<void> => {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
};

const fakeFile = (name: string, size = 1): File => ({ name, size } as File);

const setInputFiles = (files: readonly File[]): void => {
  const input = document.querySelector<HTMLInputElement>('#import-file-input')!;
  Object.defineProperty(input, 'files', {
    configurable: true,
    value: files,
  });
  input.dispatchEvent(new Event('change', { bubbles: true }));
};

const dropEvent = (
  files: readonly File[],
  types: readonly string[] = files.length > 0 ? ['Files'] : ['text/plain'],
): Event => {
  const event = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(event, 'dataTransfer', {
    value: { files, types },
  });
  return event;
};

interface Harness {
  readonly controller: IoToolsController;
  readonly source: { readonly getHtml: ReturnType<typeof vi.fn> };
  readonly visual: {
    readonly getHtml: ReturnType<typeof vi.fn>;
    readonly getText: ReturnType<typeof vi.fn>;
    readonly onFileDrop: ReturnType<typeof vi.fn>;
  };
  readonly sync: { readonly flushActive: ReturnType<typeof vi.fn> };
  readonly apply: ReturnType<typeof vi.fn>;
  readonly operations: {
    readonly importHtml: ReturnType<typeof vi.fn>;
    readonly importDocx: ReturnType<typeof vi.fn>;
    readonly download: ReturnType<typeof vi.fn>;
    readonly copyHtml: ReturnType<typeof vi.fn>;
    readonly copyText: ReturnType<typeof vi.fn>;
  };
  readonly confirmNewDocument: ReturnType<typeof vi.fn>;
  readonly setHtml: (html: string) => void;
}

const controllers: IoToolsController[] = [];

const createHarness = (
  initialHtml = '<p>Initial</p>',
  optionOverrides: Partial<IoToolsOptions> = {},
): Harness => {
  document.body.innerHTML = markup;
  let html = initialHtml;
  let visualDrop: ((files: readonly File[]) => void) | null = null;
  const source = { getHtml: vi.fn(() => html) };
  const visual = {
    getHtml: vi.fn(() => '<p>Visual canonical</p>'),
    getText: vi.fn(() => 'Visual text'),
    onFileDrop: vi.fn((listener: (files: readonly File[]) => void) => {
      visualDrop = listener;
      return vi.fn(() => { visualDrop = null; });
    }),
  };
  const sync = { flushActive: vi.fn() };
  const apply = vi.fn((_label: string, nextHtml: string, _snapshotHtml: string) => {
    html = nextHtml;
  });
  const operations = {
    importHtml: vi.fn(async () => '<p>Imported HTML</p>'),
    importDocx: vi.fn(async () => ({
      html: '<p>Imported DOCX</p>',
      warnings: [],
      omittedWarningCount: 0,
    })),
    download: vi.fn(),
    copyHtml: vi.fn(async () => ({ ok: true, method: 'clipboard-api' as const })),
    copyText: vi.fn(async () => ({ ok: true, method: 'clipboard-api' as const })),
  };
  const confirmNewDocument = vi.fn(() => true);
  const controller = createIoToolsController(source, visual, sync, { apply }, {
    draftLoadResult: { status: 'empty' },
    document,
    window,
    operations,
    confirmNewDocument,
    ...optionOverrides,
  });
  controllers.push(controller);

  return {
    controller,
    source,
    visual,
    sync,
    apply,
    operations,
    confirmNewDocument,
    setHtml: (nextHtml) => { html = nextHtml; },
  };
};

describe('I/O tools controller', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    Object.defineProperty(window, 'requestAnimationFrame', {
      configurable: true,
      value: (callback: FrameRequestCallback): number => {
        callback(0);
        return 1;
      },
    });
  });

  afterEach(() => {
    controllers.splice(0).forEach((controller) => controller.destroy());
    vi.useRealTimers();
    document.body.replaceChildren();
    localStorage.clear();
  });

  it('keeps the programmatic file picker out of the keyboard order', () => {
    createHarness();
    const input = document.querySelector<HTMLInputElement>('#import-file-input')!;
    const inputClick = vi.spyOn(input, 'click');

    expect(input.hidden).toBe(true);
    document.querySelector<HTMLButtonElement>('#choose-import-file')!.click();
    expect(inputClick).toHaveBeenCalledOnce();
  });

  it('imports HTML and DOCX through the mass writer with the captured snapshots', async () => {
    const harness = createHarness('<p>Before HTML</p>');

    setInputFiles([fakeFile('page.HTML')]);
    await settle();
    expect(harness.operations.importHtml).toHaveBeenCalledWith(expect.objectContaining({
      name: 'page.HTML',
    }));
    expect(harness.apply).toHaveBeenNthCalledWith(
      1,
      'import page.HTML',
      '<p>Imported HTML</p>',
      '<p>Before HTML</p>',
    );

    harness.setHtml('<p>Before DOCX</p>');
    harness.operations.importDocx.mockResolvedValueOnce({
      html: '<h1>Imported DOCX</h1>',
      warnings: [{ type: 'warning', message: 'Style', truncated: false }],
      omittedWarningCount: 2,
    });
    setInputFiles([fakeFile('letter.DoCx')]);
    await settle();

    expect(harness.operations.importDocx).toHaveBeenCalledWith(expect.objectContaining({
      name: 'letter.DoCx',
    }));
    expect(harness.apply).toHaveBeenNthCalledWith(
      2,
      'import letter.DoCx',
      '<h1>Imported DOCX</h1>',
      '<p>Before DOCX</p>',
    );
    expect(document.querySelector('#io-result')?.textContent).toContain('Warnings: 3');
    expect(harness.sync.flushActive).toHaveBeenCalledTimes(4);
  });

  it('discards an asynchronous import result after a user edit', async () => {
    const pending = deferred<string>();
    const harness = createHarness('<p>Snapshot</p>');
    harness.operations.importHtml.mockReturnValueOnce(pending.promise);

    setInputFiles([fakeFile('slow.html')]);
    await settle();
    expect(harness.operations.importHtml).toHaveBeenCalledOnce();

    harness.setHtml('<p>User edit</p>');
    pending.resolve('<p>Stale import</p>');
    await settle();

    expect(harness.apply).not.toHaveBeenCalled();
    expect(document.querySelector('#io-result')?.textContent)
      .toBe('The document changed during the operation, so the imported result was not applied.');
  });

  it('shows errors for multiple, unsupported and oversized files without a mass write', async () => {
    const harness = createHarness();

    setInputFiles([fakeFile('one.html'), fakeFile('two.html')]);
    expect(document.querySelector('#io-result')?.textContent)
      .toBe('Import one file at a time.');

    harness.operations.importDocx.mockRejectedValueOnce(new ImportFileError(
      'unsupported-extension',
      'unsupported',
    ));
    setInputFiles([fakeFile('notes.txt')]);
    await settle();
    expect(document.querySelector('#io-result')?.textContent)
      .toBe('Only .html, .htm, and .docx files are supported.');

    harness.operations.importDocx.mockRejectedValueOnce(new ImportFileError(
      'file-too-large',
      'too large',
    ));
    setInputFiles([fakeFile('large.docx', MAX_IMPORT_BYTES + 1)]);
    await settle();
    expect(document.querySelector('#io-result')?.textContent)
      .toBe('The file exceeds the 5 MB limit.');
    expect(harness.apply).not.toHaveBeenCalled();
  });

  it('intercepts file drops on the outer workspace but preserves text drops', async () => {
    const harness = createHarness('<p>Drop target</p>');
    const workspace = document.querySelector<HTMLElement>('#editor-workspace')!;

    const textDrop = dropEvent([]);
    workspace.dispatchEvent(textDrop);
    expect(textDrop.defaultPrevented).toBe(false);
    expect(harness.operations.importHtml).not.toHaveBeenCalled();

    const fileDrop = dropEvent([fakeFile('dropped.html')]);
    workspace.dispatchEvent(fileDrop);
    expect(fileDrop.defaultPrevented).toBe(true);
    await settle();

    expect(harness.operations.importHtml).toHaveBeenCalledOnce();
    expect(harness.apply).toHaveBeenCalledWith(
      'import dropped.html',
      '<p>Imported HTML</p>',
      '<p>Drop target</p>',
    );
  });

  it('puts sample and confirmed new-document actions on the same mass stack', () => {
    const harness = createHarness('<p>Original</p>');
    harness.confirmNewDocument.mockReturnValueOnce(false).mockReturnValueOnce(true);

    document.querySelector<HTMLButtonElement>('#load-example')!.click();
    expect(harness.apply).toHaveBeenNthCalledWith(
      1,
      'load example',
      expect.stringContaining('<h1 class="generated-title"'),
      '<p>Original</p>',
    );

    document.querySelector<HTMLButtonElement>('#new-document')!.click();
    expect(harness.apply).toHaveBeenCalledTimes(1);
    document.querySelector<HTMLButtonElement>('#new-document')!.click();

    expect(harness.confirmNewDocument).toHaveBeenCalledTimes(2);
    expect(harness.apply).toHaveBeenNthCalledWith(
      2,
      'new document',
      '',
      expect.stringContaining('<h1 class="generated-title"'),
    );
  });

  it('flushes before export and clipboard reads and never reports a failed copy as success', async () => {
    const harness = createHarness('<p>Source raw</p>');
    harness.operations.copyHtml.mockResolvedValueOnce({ ok: false, method: null });

    document.querySelector<HTMLButtonElement>('#export-html')!.click();
    expect(harness.operations.download).toHaveBeenCalledWith('<p>Visual canonical</p>');
    expect(harness.sync.flushActive.mock.invocationCallOrder[0])
      .toBeLessThan(harness.visual.getHtml.mock.invocationCallOrder[0] ?? Infinity);
    expect(harness.visual.getHtml.mock.invocationCallOrder[0])
      .toBeLessThan(harness.operations.download.mock.invocationCallOrder[0] ?? Infinity);

    document.querySelector<HTMLButtonElement>('#copy-html')!.click();
    await settle();
    expect(harness.operations.copyHtml).toHaveBeenCalledWith('<p>Visual canonical</p>');
    expect(document.querySelector('#io-result')?.textContent)
      .toBe('HTML was not copied because the browser denied clipboard access.');
    expect(document.querySelector('#io-result')?.textContent).not.toContain('HTML was copied');

    document.querySelector<HTMLButtonElement>('#copy-text')!.click();
    await settle();
    expect(harness.operations.copyText).toHaveBeenCalledWith('Visual text');
    expect(harness.sync.flushActive).toHaveBeenCalledTimes(3);
  });

  it('reports an unexpected clipboard rejection without leaking an unhandled promise', async () => {
    const harness = createHarness('<p>Source raw</p>');
    harness.operations.copyHtml.mockRejectedValueOnce(new Error('unexpected adapter failure'));

    document.querySelector<HTMLButtonElement>('#copy-html')!.click();
    await settle();

    expect(document.querySelector('#io-result')?.textContent)
      .toBe('HTML was not copied because the browser denied clipboard access.');
  });

  it('shows a restored draft and starts a new document without confirmation', () => {
    const restoredHtml = '<p>Restored raw draft</p>';
    const harness = createHarness(restoredHtml, {
      draftLoadResult: {
        status: 'loaded',
        draft: { html: restoredHtml, savedAt: Date.UTC(2026, 7, 14, 12) },
        bytes: restoredHtml.length,
      },
    });

    const notice = document.querySelector<HTMLElement>('#draft-notice')!;
    expect(notice.hidden).toBe(false);
    expect(document.querySelector('#draft-message')?.textContent)
      .toContain('Restored a local draft');
    expect(document.querySelector<HTMLButtonElement>('#discard-restored-draft')?.hidden)
      .toBe(false);

    document.querySelector<HTMLButtonElement>('#discard-restored-draft')!.click();

    expect(harness.confirmNewDocument).not.toHaveBeenCalled();
    expect(harness.apply).toHaveBeenCalledWith(
      'new document',
      '',
      restoredHtml,
    );
    expect(notice.hidden).toBe(true);
    expect(JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}')).toMatchObject({ html: '' });
  });

  it.each([
    ['invalid', { status: 'invalid' as const }],
    ['oversized', { status: 'too-large' as const, bytes: 1_048_577, limit: 1_048_576 }],
  ])('replaces an %s stored draft on the first autosave', async (_label, draftLoadResult) => {
    localStorage.setItem(DRAFT_STORAGE_KEY, 'unusable stored value');
    createHarness('', { draftLoadResult });

    await vi.advanceTimersByTimeAsync(DRAFT_AUTOSAVE_INTERVAL_MS);

    expect(JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}')).toMatchObject({ html: '' });
    expect(document.querySelector<HTMLElement>('#draft-notice')!.hidden).toBe(true);
  });

  it('starts interval autosave and saveFinal stops it after persisting the latest source', async () => {
    const harness = createHarness('<p>Initial draft</p>');

    harness.setHtml('<p>Autosaved</p>');
    await vi.advanceTimersByTimeAsync(DRAFT_AUTOSAVE_INTERVAL_MS);
    expect(JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}')).toMatchObject({
      html: '<p>Autosaved</p>',
    });

    harness.setHtml('<p>Final</p>');
    expect(harness.controller.saveDraftFinal().status).toBe('saved');
    expect(JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}')).toMatchObject({
      html: '<p>Final</p>',
    });

    harness.setHtml('<p>Must not be autosaved</p>');
    await vi.advanceTimersByTimeAsync(DRAFT_AUTOSAVE_INTERVAL_MS * 2);
    expect(JSON.parse(localStorage.getItem(DRAFT_STORAGE_KEY) ?? '{}')).toMatchObject({
      html: '<p>Final</p>',
    });
  });
});
