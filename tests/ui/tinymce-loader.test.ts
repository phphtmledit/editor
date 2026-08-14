import type { TinyMCE } from 'tinymce';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const installTiny = (): TinyMCE => {
  const tiny = { init: vi.fn() } as unknown as TinyMCE;
  Object.defineProperty(window, 'tinymce', {
    configurable: true,
    writable: true,
    value: tiny,
  });
  return tiny;
};

const removeTiny = (): void => {
  Reflect.deleteProperty(window, 'tinymce');
};

const runtimeScripts = (): HTMLScriptElement[] =>
  [...document.querySelectorAll<HTMLScriptElement>('script[src]')]
    .filter((script) => script.getAttribute('src') === '/tinymce/tinymce.min.js?v=8.8.2');

describe('TinyMCE runtime loader', () => {
  beforeEach(() => {
    vi.resetModules();
    removeTiny();
    document.head.querySelectorAll('script').forEach((script) => script.remove());
    performance.clearMarks();
  });

  afterEach(() => {
    removeTiny();
    document.head.querySelectorAll('script').forEach((script) => script.remove());
    performance.clearMarks();
  });

  it('resolves an existing TinyMCE global without inserting a script', async () => {
    const tiny = installTiny();
    const { BOOTSTRAP_PERFORMANCE_MARKS } = await import('../../src/bootstrap');
    const { loadTinyMce } = await import('../../src/tinymce-loader');

    const first = loadTinyMce();
    const second = loadTinyMce();
    expect(second).toBe(first);
    await expect(first).resolves.toBe(tiny);
    expect(runtimeScripts()).toEqual([]);
    expect(performance.getEntriesByName(
      BOOTSTRAP_PERFORMANCE_MARKS.tinyRuntimeLoaded,
      'mark',
    )).toHaveLength(1);
  });

  it('inserts the exact self-hosted runtime and resolves only after its load event', async () => {
    const { BOOTSTRAP_PERFORMANCE_MARKS } = await import('../../src/bootstrap');
    const { loadTinyMce, TINYMCE_RUNTIME_URL } = await import('../../src/tinymce-loader');
    const pending = loadTinyMce();
    const [script] = runtimeScripts();
    let resolved = false;
    void pending.then(() => { resolved = true; });

    expect(script?.getAttribute('src')).toBe(TINYMCE_RUNTIME_URL);
    expect(script?.async).toBe(true);
    expect(performance.getEntriesByName(
      BOOTSTRAP_PERFORMANCE_MARKS.tinyScriptInserted,
      'mark',
    )).toHaveLength(1);
    await Promise.resolve();
    expect(resolved).toBe(false);

    const tiny = installTiny();
    script?.dispatchEvent(new Event('load'));
    await expect(pending).resolves.toBe(tiny);
    expect(performance.getEntriesByName(
      BOOTSTRAP_PERFORMANCE_MARKS.tinyRuntimeLoaded,
      'mark',
    )).toHaveLength(1);
  });

  it('deduplicates concurrent calls even when the global appears before load', async () => {
    const { BOOTSTRAP_PERFORMANCE_MARKS } = await import('../../src/bootstrap');
    const { loadTinyMce } = await import('../../src/tinymce-loader');
    const first = loadTinyMce();
    const tiny = installTiny();
    const second = loadTinyMce();
    let resolved = false;
    void second.then(() => { resolved = true; });

    expect(second).toBe(first);
    expect(runtimeScripts()).toHaveLength(1);
    await Promise.resolve();
    expect(resolved).toBe(false);
    expect(performance.getEntriesByName(
      BOOTSTRAP_PERFORMANCE_MARKS.tinyRuntimeLoaded,
      'mark',
    )).toHaveLength(0);

    runtimeScripts()[0]?.dispatchEvent(new Event('load'));
    await expect(first).resolves.toBe(tiny);
    await expect(second).resolves.toBe(tiny);
  });

  it('reuses a matching in-flight script already present in the document', async () => {
    const script = document.createElement('script');
    script.src = '/tinymce/tinymce.min.js?v=8.8.2';
    script.setAttribute('data-phe-tinymce-runtime', 'true');
    script.setAttribute('data-phe-tinymce-state', 'loading');
    document.head.append(script);
    const { loadTinyMce } = await import('../../src/tinymce-loader');
    const pending = loadTinyMce();
    const tiny = installTiny();

    expect(runtimeScripts()).toEqual([script]);
    script.dispatchEvent(new Event('load'));
    await expect(pending).resolves.toBe(tiny);
  });

  it('rejects an unmanaged exact-URL script instead of waiting for an event that already fired', async () => {
    const script = document.createElement('script');
    script.src = '/tinymce/tinymce.min.js?v=8.8.2';
    document.head.append(script);
    const { loadTinyMce } = await import('../../src/tinymce-loader');

    await expect(loadTinyMce()).rejects.toThrow('unmanaged TinyMCE runtime script');
    expect(runtimeScripts()).toEqual([script]);
  });

  it('rejects and removes a completed loader script with no global, then retries cleanly', async () => {
    const completed = document.createElement('script');
    completed.src = '/tinymce/tinymce.min.js?v=8.8.2';
    completed.setAttribute('data-phe-tinymce-runtime', 'true');
    completed.setAttribute('data-phe-tinymce-state', 'loaded');
    document.head.append(completed);
    const { loadTinyMce } = await import('../../src/tinymce-loader');

    await expect(loadTinyMce()).rejects.toThrow('completed without a valid global');
    expect(completed.isConnected).toBe(false);

    const retry = loadTinyMce();
    const retryScript = runtimeScripts()[0];
    const tiny = installTiny();
    retryScript?.dispatchEvent(new Event('load'));
    await expect(retry).resolves.toBe(tiny);
  });

  it('rejects a failed request, removes its script, and permits a clean retry', async () => {
    const { loadTinyMce } = await import('../../src/tinymce-loader');
    const first = loadTinyMce();
    const firstScript = runtimeScripts()[0];

    firstScript?.dispatchEvent(new Event('error'));
    await expect(first).rejects.toThrow('TinyMCE runtime failed to load');
    expect(firstScript?.isConnected).toBe(false);

    const retry = loadTinyMce();
    const retryScript = runtimeScripts()[0];
    expect(retryScript).toBeDefined();
    expect(retryScript).not.toBe(firstScript);
    const tiny = installTiny();
    retryScript?.dispatchEvent(new Event('load'));
    await expect(retry).resolves.toBe(tiny);
  });

  it('rejects a load event that does not expose a valid TinyMCE global', async () => {
    const { loadTinyMce } = await import('../../src/tinymce-loader');
    const pending = loadTinyMce();
    const script = runtimeScripts()[0];

    script?.dispatchEvent(new Event('load'));

    await expect(pending).rejects.toThrow('without exposing window.tinymce');
    expect(script?.isConnected).toBe(false);
  });

  it('emits the complete runtime bootstrap mark sequence in execution order', async () => {
    const {
      BOOTSTRAP_PERFORMANCE_MARKS,
      runEditorBootstrap,
      waitForPaintHandoff,
    } = await import('../../src/bootstrap');
    const { loadTinyMce } = await import('../../src/tinymce-loader');
    let paintCallback: (() => void) | null = null;
    let taskCallback: (() => void) | null = null;
    const initialise = vi.fn(async () => undefined);
    const pending = runEditorBootstrap({
      waitForPaintHandoff: () => waitForPaintHandoff(undefined, {
        firstContentfulPaintRecorded: () => false,
        observeFirstContentfulPaint: (callback) => {
          paintCallback = callback;
          return () => undefined;
        },
        scheduleTask: (callback) => {
          taskCallback = callback;
          return 2;
        },
        cancelTask: vi.fn(),
      }),
      loadTinyMce,
      initialise,
    });

    (paintCallback as (() => void) | null)?.();
    (taskCallback as (() => void) | null)?.();
    await Promise.resolve();
    const tiny = installTiny();
    runtimeScripts()[0]?.dispatchEvent(new Event('load'));
    await expect(pending).resolves.toBeUndefined();
    expect(initialise).toHaveBeenCalledOnce();

    const names = performance.getEntriesByType('mark').map(({ name }) => name);
    expect(names).toEqual([
      BOOTSTRAP_PERFORMANCE_MARKS.paintHandoffComplete,
      BOOTSTRAP_PERFORMANCE_MARKS.tinyScriptInserted,
      BOOTSTRAP_PERFORMANCE_MARKS.tinyRuntimeLoaded,
      BOOTSTRAP_PERFORMANCE_MARKS.initialiseStarted,
      BOOTSTRAP_PERFORMANCE_MARKS.editorReady,
    ]);
    expect(tiny).toBeDefined();
  });
});
