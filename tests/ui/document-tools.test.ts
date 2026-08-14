import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { MassDocumentController } from '../../src/editor/mass-document';
import type { MassUndoState } from '../../src/editor/mass-undo';
import {
  CLEAN_SETTINGS_STORAGE_KEY,
  createDocumentToolsController,
  type DocumentToolsController,
} from '../../src/ui/document-tools';

const markup = `
  <section id="document-tools">
    <button id="undo-mass-operation" type="button"></button>
    <output id="undo-mass-description"></output>
    <article class="tool-panel">
      <div id="cleaning-rule-list"></div>
      <button id="clean-selected-rules" type="button"></button>
      <button id="format-html" type="button"></button>
      <button id="minify-html" type="button"></button>
      <output id="cleaning-result"></output>
    </article>
    <article class="tool-panel">
      <button id="add-replacement-rule" type="button"></button>
      <div id="replacement-rule-list"></div>
      <button id="apply-all-replacements" type="button"></button>
      <output id="replacement-result"></output>
    </article>
  </section>
`;

class DeferredWorker {
  static instances: DeferredWorker[] = [];

  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: ErrorEvent) => void) | null = null;
  onmessageerror: (() => void) | null = null;
  readonly terminate = vi.fn();

  constructor() {
    DeferredWorker.instances.push(this);
  }

  postMessage(): void {}

  resolve(html: string, count: number): void {
    this.onmessage?.(new MessageEvent('message', {
      data: { ok: true, result: { html, count, error: null } },
    }));
  }
}

interface Harness {
  controller: DocumentToolsController;
  source: { getHtml: ReturnType<typeof vi.fn> };
  sync: { flushActive: ReturnType<typeof vi.fn> };
  apply: ReturnType<typeof vi.fn>;
  undo: ReturnType<typeof vi.fn>;
  setHtml: (html: string) => void;
}

const createHarness = (
  initialHtml: string,
  storage?: Pick<Storage, 'getItem' | 'setItem'>,
): Harness => {
  document.body.innerHTML = markup;
  let html = initialHtml;
  const snapshots: Array<{ html: string; label: string }> = [];
  const listeners = new Set<(state: MassUndoState) => void>();
  const state = (): MassUndoState => ({
    count: snapshots.length,
    totalBytes: 0,
    nextLabel: snapshots.at(-1)?.label ?? null,
  });
  const emit = (): void => listeners.forEach((listener) => listener(state()));
  const apply = vi.fn((label: string, nextHtml: string, snapshotHtml: string) => {
    if (nextHtml !== snapshotHtml) {
      snapshots.push({ html: snapshotHtml, label });
      html = nextHtml;
      emit();
    }
    return { html, label };
  });
  const undo = vi.fn(() => {
    const snapshot = snapshots.pop();
    if (!snapshot) return null;
    html = snapshot.html;
    emit();
    return { html, label: snapshot.label };
  });
  const mass: MassDocumentController = {
    apply,
    undo,
    getUndoState: state,
    onUndoStateChange: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
  const source = { getHtml: vi.fn(() => html) };
  const sync = { flushActive: vi.fn() };
  return {
    controller: createDocumentToolsController(source, sync, mass, document, storage),
    source,
    sync,
    apply,
    undo,
    setHtml: (nextHtml) => {
      html = nextHtml;
    },
  };
};

describe('document tools controller', () => {
  let controller: DocumentToolsController | null = null;

  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    DeferredWorker.instances = [];
  });

  afterEach(() => {
    controller?.destroy();
    controller = null;
    vi.unstubAllGlobals();
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('renders ten rules with documented defaults and a visible AI priority', () => {
    const harness = createHarness('<p>Test</p>');
    controller = harness.controller;

    const rows = document.querySelectorAll('.cleaning-rule');
    const checked = document.querySelectorAll<HTMLInputElement>('.cleaning-rule input:checked');
    const attributes = document.querySelector<HTMLInputElement>('#clean-rule-tag-attributes');
    const plainText = document.querySelector<HTMLInputElement>('#clean-rule-plain-text');
    const aiRow = document.querySelector('#clean-rule-ai-symbols')?.closest('.cleaning-rule');
    expect(rows).toHaveLength(10);
    expect(checked).toHaveLength(8);
    expect(attributes?.checked).toBe(false);
    expect(plainText?.checked).toBe(false);
    expect(aiRow?.classList.contains('is-priority')).toBe(true);
  });

  it('flushes editing and uses the mass writer for an individual clean rule', async () => {
    const harness = createHarness('<p style="color: red">Test</p>');
    controller = harness.controller;

    document.querySelector<HTMLButtonElement>(
      '#clean-rule-inline-styles + label + button',
    )?.click();
    const panel = document.querySelector('#cleaning-rule-list')?.closest('.tool-panel');
    expect(panel?.getAttribute('aria-busy')).toBe('true');
    await vi.runAllTimersAsync();

    expect(harness.sync.flushActive).toHaveBeenCalledTimes(2);
    expect(harness.sync.flushActive.mock.invocationCallOrder[0])
      .toBeLessThan(harness.source.getHtml.mock.invocationCallOrder[0] ?? Infinity);
    expect(harness.apply).toHaveBeenCalledWith(
      'clean — Inline styles',
      '<p>Test</p>',
      '<p style="color: red">Test</p>',
    );
    expect(document.querySelector('#cleaning-result')?.textContent)
      .toBe('Applied the “Inline styles” rule.');
  });

  it('does not overwrite an edit made while cooperative cleaning is yielding', async () => {
    const harness = createHarness('<p class="dirty" style="color:red">Test&nbsp;&nbsp;value</p>');
    controller = harness.controller;

    document.querySelector<HTMLButtonElement>('#clean-selected-rules')?.click();
    await vi.advanceTimersToNextTimerAsync();
    await vi.advanceTimersToNextTimerAsync();
    harness.setHtml('<p>User edit</p>');
    await vi.runAllTimersAsync();

    expect(harness.apply).not.toHaveBeenCalled();
    expect(document.querySelector('#cleaning-result')?.textContent)
      .toBe('The document changed during the operation, so its result was not applied.');
  });

  it('marks an invalid regular expression and creates no mass operation', async () => {
    const harness = createHarness('<p>Test</p>');
    controller = harness.controller;

    document.querySelector<HTMLButtonElement>('#add-replacement-rule')?.click();
    const find = document.querySelector<HTMLInputElement>('[data-field="find"]')!;
    const regex = document.querySelector<HTMLInputElement>('[data-field="isRegex"]')!;
    find.value = '[';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    regex.checked = true;
    regex.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('[data-action="apply"]')?.click();
    await vi.runAllTimersAsync();

    expect(find.getAttribute('aria-invalid')).toBe('true');
    expect(document.querySelector('[data-role="error"]')?.textContent)
      .toBe('The regular expression is invalid.');
    expect(harness.apply).not.toHaveBeenCalled();
  });

  it('does not overwrite an edit made while a regex Worker is pending', async () => {
    vi.stubGlobal('Worker', DeferredWorker);
    const harness = createHarness('<p>Test</p>');
    controller = harness.controller;

    document.querySelector<HTMLButtonElement>('#add-replacement-rule')?.click();
    const find = document.querySelector<HTMLInputElement>('[data-field="find"]')!;
    const replacement = document.querySelector<HTMLInputElement>('[data-field="replacement"]')!;
    const regex = document.querySelector<HTMLInputElement>('[data-field="isRegex"]')!;
    find.value = 'Test';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    replacement.value = 'Done';
    replacement.dispatchEvent(new Event('input', { bubbles: true }));
    regex.checked = true;
    regex.dispatchEvent(new Event('change', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('[data-action="apply"]')?.click();

    await vi.advanceTimersByTimeAsync(20);
    await vi.dynamicImportSettled();
    await vi.advanceTimersByTimeAsync(0);
    expect(DeferredWorker.instances).toHaveLength(1);
    harness.setHtml('<p>User edit</p>');
    DeferredWorker.instances[0]?.resolve('<p>Done</p>', 1);
    await vi.advanceTimersByTimeAsync(0);

    expect(harness.apply).not.toHaveBeenCalled();
    expect(document.querySelector('#replacement-result')?.textContent)
      .toBe('The document changed during the operation, so its result was not applied.');
  });

  it('reports exact counts and exposes one common mass undo', async () => {
    const harness = createHarness('<p>Codex Codex</p>');
    controller = harness.controller;

    document.querySelector<HTMLButtonElement>('#add-replacement-rule')?.click();
    const find = document.querySelector<HTMLInputElement>('[data-field="find"]')!;
    const replacement = document.querySelector<HTMLInputElement>('[data-field="replacement"]')!;
    find.value = 'Codex';
    find.dispatchEvent(new Event('input', { bubbles: true }));
    replacement.value = 'Editor';
    replacement.dispatchEvent(new Event('input', { bubbles: true }));
    document.querySelector<HTMLButtonElement>('[data-action="apply"]')?.click();
    await vi.runAllTimersAsync();

    expect(document.querySelector('#replacement-result')?.textContent).toBe('Replacements made: 2.');
    expect(document.querySelectorAll('#undo-mass-operation')).toHaveLength(1);
    expect(document.querySelector('#undo-mass-description')?.textContent)
      .toBe('Can undo: replace — rule 1.');

    document.querySelector<HTMLButtonElement>('#undo-mass-operation')?.click();
    await vi.runAllTimersAsync();
    expect(harness.undo).toHaveBeenCalledOnce();
    expect(document.querySelector('#undo-mass-description')?.textContent)
      .toBe('Undone: replace — rule 1. No mass operations to undo.');
  });

  it('recovers from invalid versioned cleaning settings', () => {
    localStorage.setItem(CLEAN_SETTINGS_STORAGE_KEY, '{"version":999,"enabledRuleIds":[]}');
    const harness = createHarness('<p>Test</p>');
    controller = harness.controller;

    expect(document.querySelectorAll('.cleaning-rule input:checked')).toHaveLength(8);
    expect(document.querySelector('#cleaning-result')?.textContent)
      .toContain('the defaults have been restored');
  });

  it('does not hide a storage error when a replacement rule is removed', () => {
    const failingStorage = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(() => {
        throw new DOMException('Blocked', 'SecurityError');
      }),
    };
    const harness = createHarness('<p>Test</p>', failingStorage);
    controller = harness.controller;

    document.querySelector<HTMLButtonElement>('#add-replacement-rule')?.click();
    document.querySelector<HTMLButtonElement>('[data-action="remove"]')?.click();

    expect(document.querySelector('#replacement-result')?.textContent)
      .toBe('The rules could not be saved.');
  });
});
