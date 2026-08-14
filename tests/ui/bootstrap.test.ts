import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const deferred = <T,>() => {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
};

describe('editor bootstrap scheduling', () => {
  beforeEach(() => {
    vi.resetModules();
    performance.clearMarks();
  });

  it('keeps executable code out of head and publishes the exact TinyMCE preload', async () => {
    const { TINYMCE_RUNTIME_URL } = await import('../../src/tinymce-loader');
    const html = readFileSync(resolve(import.meta.dirname, '../../index.html'), 'utf8');
    const page = new DOMParser().parseFromString(html, 'text/html');
    const runtimeScripts = [...page.querySelectorAll<HTMLScriptElement>('script[src]')]
      .filter((script) => script.getAttribute('src')?.includes('/tinymce/tinymce.min.js'));
    const runtimePreloads = [...page.querySelectorAll<HTMLLinkElement>('link[rel="preload"]')]
      .filter((link) => link.getAttribute('href') === TINYMCE_RUNTIME_URL);

    expect(page.head.querySelectorAll('script')).toHaveLength(0);
    expect(runtimeScripts).toEqual([]);
    expect(runtimePreloads).toHaveLength(1);
    expect(runtimePreloads[0]?.getAttribute('as')).toBe('script');
  });

  it('waits for observed first-contentful-paint and then a later task', async () => {
    const { BOOTSTRAP_PERFORMANCE_MARKS, waitForPaintHandoff } = await import('../../src/bootstrap');
    const events: string[] = [];
    const disconnect = vi.fn();
    let paintCallback: (() => void) | null = null;
    let taskCallback: (() => void) | null = null;
    const pending = waitForPaintHandoff(undefined, {
      firstContentfulPaintRecorded: () => false,
      observeFirstContentfulPaint: (callback) => {
        events.push('observe-paint');
        paintCallback = callback;
        return disconnect;
      },
      scheduleTask: (callback) => {
        events.push('schedule-task');
        taskCallback = callback;
        return 1;
      },
      cancelTask: vi.fn(),
    });
    let resolved = false;
    void pending.then(() => { resolved = true; });

    expect(events).toEqual(['observe-paint']);
    expect(resolved).toBe(false);
    (paintCallback as (() => void) | null)?.();
    await Promise.resolve();
    expect(events).toEqual(['observe-paint', 'schedule-task']);
    expect(resolved).toBe(false);
    (taskCallback as (() => void) | null)?.();
    await pending;

    expect(resolved).toBe(true);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(performance.getEntriesByName(
      BOOTSTRAP_PERFORMANCE_MARKS.paintHandoffComplete,
      'mark',
    )).toHaveLength(1);
  });

  it('does not start runtime loading before observed paint and its task handoff', async () => {
    const { runEditorBootstrap, waitForPaintHandoff } = await import('../../src/bootstrap');
    let paintCallback: (() => void) | null = null;
    let taskCallback: (() => void) | null = null;
    const loadTinyMce = vi.fn(async () => undefined);
    const pending = runEditorBootstrap({
      waitForPaintHandoff: () => waitForPaintHandoff(undefined, {
        firstContentfulPaintRecorded: () => false,
        observeFirstContentfulPaint: (callback) => {
          paintCallback = callback;
          return () => undefined;
        },
        scheduleTask: (callback) => {
          taskCallback = callback;
          return 1;
        },
        cancelTask: vi.fn(),
      }),
      loadTinyMce,
      initialise: vi.fn(async () => undefined),
    });

    await Promise.resolve();
    expect(loadTinyMce).not.toHaveBeenCalled();
    (paintCallback as (() => void) | null)?.();
    await Promise.resolve();
    expect(loadTinyMce).not.toHaveBeenCalled();
    (taskCallback as (() => void) | null)?.();
    await pending;
    expect(loadTinyMce).toHaveBeenCalledOnce();
  });

  it('uses an already-recorded first-contentful-paint but still waits for a task', async () => {
    const { waitForPaintHandoff } = await import('../../src/bootstrap');
    const observe = vi.fn(() => () => undefined);
    let taskCallback: (() => void) | null = null;
    let resolved = false;
    const pending = waitForPaintHandoff(undefined, {
      firstContentfulPaintRecorded: () => true,
      observeFirstContentfulPaint: observe,
      scheduleTask: (callback) => {
        taskCallback = callback;
        return 1;
      },
      cancelTask: vi.fn(),
    });
    void pending.then(() => { resolved = true; });

    expect(observe).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(resolved).toBe(false);
    (taskCallback as (() => void) | null)?.();
    await pending;
    expect(resolved).toBe(true);
  });

  it('uses double rAF and then a task when Paint Timing observation fails', async () => {
    const { waitForPaintHandoff } = await import('../../src/bootstrap');
    const frames: FrameRequestCallback[] = [];
    const tasks: Array<{ callback: () => void; delay: number }> = [];
    const cancelTask = vi.fn();
    const pending = waitForPaintHandoff(undefined, {
      firstContentfulPaintRecorded: () => false,
      observeFirstContentfulPaint: () => { throw new Error('observe failed'); },
      requestFrame: (callback) => {
        frames.push(callback);
        return frames.length;
      },
      cancelFrame: vi.fn(),
      scheduleTask: (callback, delay = 0) => {
        tasks.push({ callback, delay });
        return tasks.length;
      },
      cancelTask,
    });

    expect(frames).toHaveLength(1);
    expect(tasks).toEqual([]);
    frames[0]?.(0);
    expect(frames).toHaveLength(2);
    frames[1]?.(16);
    expect(tasks.map(({ delay }) => delay)).toEqual([0]);
    tasks[0]?.callback();

    await expect(pending).resolves.toBeUndefined();
    expect(cancelTask).not.toHaveBeenCalled();
  });

  it('takes a non-hanging task fallback when both Paint Timing and rAF are unavailable', async () => {
    const { waitForPaintHandoff } = await import('../../src/bootstrap');
    let taskCallback: (() => void) | null = null;
    const pending = waitForPaintHandoff(undefined, {
      firstContentfulPaintRecorded: () => false,
      scheduleTask: (callback) => {
        taskCallback = callback;
        return 1;
      },
      cancelTask: vi.fn(),
    });

    expect(taskCallback).not.toBeNull();
    (taskCallback as (() => void) | null)?.();
    await expect(pending).resolves.toBeUndefined();
  });

  it('disconnects Paint Timing and rejects when aborted before first-contentful-paint', async () => {
    const { BOOTSTRAP_PERFORMANCE_MARKS, BootstrapCancelledError, waitForPaintHandoff } =
      await import('../../src/bootstrap');
    const controller = new AbortController();
    const disconnect = vi.fn();
    const pending = waitForPaintHandoff(controller.signal, {
      firstContentfulPaintRecorded: () => false,
      observeFirstContentfulPaint: () => disconnect,
      scheduleTask: vi.fn(() => 1),
      cancelTask: vi.fn(),
    });

    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(BootstrapCancelledError);
    expect(disconnect).toHaveBeenCalledOnce();
    expect(performance.getEntriesByName(BOOTSTRAP_PERFORMANCE_MARKS.paintHandoffComplete, 'mark'))
      .toHaveLength(0);
  });

  it('cancels the queued handoff task when aborted after paint', async () => {
    const { BOOTSTRAP_PERFORMANCE_MARKS, BootstrapCancelledError, waitForPaintHandoff } =
      await import('../../src/bootstrap');
    const controller = new AbortController();
    let paintCallback: (() => void) | null = null;
    let taskCallback: (() => void) | null = null;
    const cancelTask = vi.fn();
    const pending = waitForPaintHandoff(controller.signal, {
      firstContentfulPaintRecorded: () => false,
      observeFirstContentfulPaint: (callback) => {
        paintCallback = callback;
        return () => undefined;
      },
      scheduleTask: (callback) => {
        taskCallback = callback;
        return 7;
      },
      cancelTask,
    });
    (paintCallback as (() => void) | null)?.();

    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(BootstrapCancelledError);
    expect(cancelTask).toHaveBeenCalledWith(7);
    (taskCallback as (() => void) | null)?.();
    expect(performance.getEntriesByName(BOOTSTRAP_PERFORMANCE_MARKS.paintHandoffComplete, 'mark'))
      .toHaveLength(0);
  });

  it('still rejects cancellation when observer cleanup throws', async () => {
    const { BootstrapCancelledError, waitForPaintHandoff } = await import('../../src/bootstrap');
    const controller = new AbortController();
    const pending = waitForPaintHandoff(controller.signal, {
      firstContentfulPaintRecorded: () => false,
      observeFirstContentfulPaint: () => () => { throw new Error('disconnect failed'); },
      scheduleTask: vi.fn(() => 7),
      cancelTask: vi.fn(),
    });

    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(BootstrapCancelledError);
  });

  it('still rejects cancellation when fallback frame cleanup throws', async () => {
    const { BootstrapCancelledError, waitForPaintHandoff } = await import('../../src/bootstrap');
    const controller = new AbortController();
    const cancelFrame = vi.fn(() => { throw new Error('cancel frame failed'); });
    const pending = waitForPaintHandoff(controller.signal, {
      firstContentfulPaintRecorded: () => false,
      requestFrame: vi.fn(() => 3),
      cancelFrame,
      scheduleTask: vi.fn(() => 7),
      cancelTask: vi.fn(),
    });

    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(BootstrapCancelledError);
    expect(cancelFrame).toHaveBeenCalledWith(3);
  });

  it('still rejects cancellation when queued task cleanup throws', async () => {
    const { BootstrapCancelledError, waitForPaintHandoff } = await import('../../src/bootstrap');
    const controller = new AbortController();
    let paintCallback: (() => void) | null = null;
    const cancelTask = vi.fn(() => { throw new Error('cancel task failed'); });
    const pending = waitForPaintHandoff(controller.signal, {
      firstContentfulPaintRecorded: () => false,
      observeFirstContentfulPaint: (callback) => {
        paintCallback = callback;
        return () => undefined;
      },
      scheduleTask: vi.fn(() => 7),
      cancelTask,
    });
    (paintCallback as (() => void) | null)?.();

    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(BootstrapCancelledError);
    expect(cancelTask).toHaveBeenCalledWith(7);
  });

  it('runs handoff, runtime loading, and initialisation strictly in order', async () => {
    const { BOOTSTRAP_PERFORMANCE_MARKS, runEditorBootstrap } = await import('../../src/bootstrap');
    const events: string[] = [];

    await runEditorBootstrap({
      waitForPaintHandoff: vi.fn(async () => { events.push('handoff'); }),
      loadTinyMce: vi.fn(async () => { events.push('runtime'); }),
      initialise: vi.fn(async () => { events.push('initialise'); }),
    });

    expect(events).toEqual(['handoff', 'runtime', 'initialise']);
    const orderedMarks = performance.getEntriesByType('mark').map(({ name }) => name);
    expect(orderedMarks).toEqual([
      BOOTSTRAP_PERFORMANCE_MARKS.initialiseStarted,
      BOOTSTRAP_PERFORMANCE_MARKS.editorReady,
    ]);
    expect(performance.getEntriesByName(
      BOOTSTRAP_PERFORMANCE_MARKS.editorReady,
      'mark',
    )).toHaveLength(1);
  });

  it('does not initialise or mark ready after a runtime failure', async () => {
    const { BOOTSTRAP_PERFORMANCE_MARKS, runEditorBootstrap } = await import('../../src/bootstrap');
    const initialise = vi.fn(async () => undefined);

    await expect(runEditorBootstrap({
      waitForPaintHandoff: vi.fn(async () => undefined),
      loadTinyMce: vi.fn(async () => { throw new Error('runtime failed'); }),
      initialise,
    })).rejects.toThrow('runtime failed');

    expect(initialise).not.toHaveBeenCalled();
    expect(performance.getEntriesByName(
      BOOTSTRAP_PERFORMANCE_MARKS.editorReady,
      'mark',
    )).toHaveLength(0);
  });

  it('cancels before runtime loading when terminal teardown happens during handoff', async () => {
    const { BOOTSTRAP_PERFORMANCE_MARKS, BootstrapCancelledError, runEditorBootstrap } =
      await import('../../src/bootstrap');
    const handoff = deferred<void>();
    const controller = new AbortController();
    const loadTinyMce = vi.fn(async () => undefined);
    const initialise = vi.fn(async () => undefined);
    const pending = runEditorBootstrap({
      waitForPaintHandoff: () => handoff.promise,
      loadTinyMce,
      initialise,
    }, controller.signal);

    controller.abort();
    handoff.resolve();

    await expect(pending).rejects.toBeInstanceOf(BootstrapCancelledError);
    expect(loadTinyMce).not.toHaveBeenCalled();
    expect(initialise).not.toHaveBeenCalled();
    expect(performance.getEntriesByName(BOOTSTRAP_PERFORMANCE_MARKS.editorReady, 'mark'))
      .toHaveLength(0);
  });

  it('cancels after an in-flight runtime load without starting initialisation', async () => {
    const { BOOTSTRAP_PERFORMANCE_MARKS, BootstrapCancelledError, runEditorBootstrap } =
      await import('../../src/bootstrap');
    const runtime = deferred<void>();
    const controller = new AbortController();
    const initialise = vi.fn(async () => undefined);
    const pending = runEditorBootstrap({
      waitForPaintHandoff: vi.fn(async () => undefined),
      loadTinyMce: () => runtime.promise,
      initialise,
    }, controller.signal);
    await Promise.resolve();

    controller.abort();
    runtime.resolve();

    await expect(pending).rejects.toBeInstanceOf(BootstrapCancelledError);
    expect(initialise).not.toHaveBeenCalled();
    expect(performance.getEntriesByName(BOOTSTRAP_PERFORMANCE_MARKS.editorReady, 'mark'))
      .toHaveLength(0);
  });

  it('waits for in-flight initialisation, then cancels without a late ready mark', async () => {
    const { BOOTSTRAP_PERFORMANCE_MARKS, BootstrapCancelledError, runEditorBootstrap } =
      await import('../../src/bootstrap');
    const initialisation = deferred<void>();
    const controller = new AbortController();
    const initialise = vi.fn(() => initialisation.promise);
    const pending = runEditorBootstrap({
      waitForPaintHandoff: vi.fn(async () => undefined),
      loadTinyMce: vi.fn(async () => undefined),
      initialise,
    }, controller.signal);
    await Promise.resolve();
    await Promise.resolve();

    expect(initialise).toHaveBeenCalledOnce();
    controller.abort();
    initialisation.resolve();

    await expect(pending).rejects.toBeInstanceOf(BootstrapCancelledError);
    expect(performance.getEntriesByName(BOOTSTRAP_PERFORMANCE_MARKS.initialiseStarted, 'mark'))
      .toHaveLength(1);
    expect(performance.getEntriesByName(BOOTSTRAP_PERFORMANCE_MARKS.editorReady, 'mark'))
      .toHaveLength(0);
  });

  it('always destroys partial controllers and suppresses fatal UI for cancellation', async () => {
    const { BootstrapCancelledError, handleBootstrapFailure } = await import('../../src/bootstrap');
    const events: string[] = [];
    const handlers = {
      destroy: () => { events.push('destroy'); },
      showFatal: () => { events.push('fatal'); },
    };

    handleBootstrapFailure(new Error('failed'), handlers);
    expect(events).toEqual(['destroy', 'fatal']);
    events.length = 0;
    handleBootstrapFailure(new BootstrapCancelledError(), handlers);
    expect(events).toEqual(['destroy']);
  });

  it('turns a runtime failure into the readable fatal application state', async () => {
    const { handleBootstrapFailure, runEditorBootstrap, showFatalError } =
      await import('../../src/bootstrap');
    document.body.innerHTML = `
      <main id="app" aria-busy="true">
        <div id="loading-skeleton"></div>
        <p id="app-status">Loading</p>
        <section id="app-error" class="bootstrap-fallback" hidden>Readable error</section>
      </main>`;
    const error = new Error('runtime failed');
    const log = vi.fn();

    const destroy = vi.fn();
    const initialise = vi.fn(async () => undefined);
    await runEditorBootstrap({
      waitForPaintHandoff: vi.fn(async () => undefined),
      loadTinyMce: vi.fn(async () => { throw error; }),
      initialise,
    }).catch((cause: unknown) => {
      handleBootstrapFailure(cause, {
        destroy,
        showFatal: (failure) =>
          showFatalError(failure, 'The editor failed to load.', document, log),
      });
    });

    const shell = document.getElementById('app');
    const skeleton = document.getElementById('loading-skeleton');
    const panel = document.getElementById('app-error');
    expect(skeleton?.hidden).toBe(true);
    expect(panel?.hidden).toBe(false);
    expect(panel?.classList.contains('bootstrap-fallback')).toBe(false);
    expect(panel?.textContent).toContain('Readable error');
    expect(shell?.getAttribute('aria-busy')).toBe('false');
    expect(shell?.classList.contains('has-fatal-error')).toBe(true);
    expect(document.getElementById('app-status')?.textContent).toBe('The editor failed to load.');
    expect(initialise).not.toHaveBeenCalled();
    expect(destroy).toHaveBeenCalledOnce();
    expect(log).toHaveBeenCalledWith('Editor initialisation failed', error);
  });
});
