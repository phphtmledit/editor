/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export const BOOTSTRAP_PERFORMANCE_MARKS = {
  paintHandoffComplete: 'phe:bootstrap:paint-handoff-complete',
  tinyScriptInserted: 'phe:bootstrap:tinymce-script-inserted',
  tinyRuntimeLoaded: 'phe:bootstrap:tinymce-runtime-loaded',
  initialiseStarted: 'phe:bootstrap:initialise-started',
  editorReady: 'phe:bootstrap:editor-ready',
} as const;

export type BootstrapPerformanceMark =
  typeof BOOTSTRAP_PERFORMANCE_MARKS[keyof typeof BOOTSTRAP_PERFORMANCE_MARKS];

const emittedPerformanceMarks = new Set<BootstrapPerformanceMark>();

/** Fixed-name, document-free marks used by the browser runtime evidence. */
export const markBootstrapPerformance = (name: BootstrapPerformanceMark): void => {
  if (emittedPerformanceMarks.has(name)) return;
  try {
    performance.mark(name);
    emittedPerformanceMarks.add(name);
  } catch {
    // Performance evidence must never become a bootstrap dependency.
  }
};

export const FIRST_CONTENTFUL_PAINT_ENTRY_NAME = 'first-contentful-paint';

export interface PaintHandoffScheduler {
  readonly firstContentfulPaintRecorded: () => boolean;
  readonly observeFirstContentfulPaint?: (callback: () => void) => () => void;
  readonly requestFrame?: (callback: FrameRequestCallback) => number;
  readonly cancelFrame?: (handle: number) => void;
  readonly scheduleTask: (callback: () => void, delayMs?: number) => number;
  readonly cancelTask: (handle: number) => void;
}

const browserPaintHandoffScheduler = (): PaintHandoffScheduler => {
  const observerAvailable = typeof PerformanceObserver === 'function' &&
    PerformanceObserver.supportedEntryTypes?.includes('paint') === true;
  return {
    firstContentfulPaintRecorded: () =>
      performance.getEntriesByName(FIRST_CONTENTFUL_PAINT_ENTRY_NAME, 'paint').length > 0,
    observeFirstContentfulPaint: observerAvailable
      ? (callback) => {
        const observer = new PerformanceObserver((list) => {
          if (list.getEntries().some(({ name }) => name === FIRST_CONTENTFUL_PAINT_ENTRY_NAME)) {
            callback();
          }
        });
        observer.observe({ type: 'paint', buffered: true });
        return () => observer.disconnect();
      }
      : undefined,
    requestFrame: (callback) => window.requestAnimationFrame(callback),
    cancelFrame: (handle) => window.cancelAnimationFrame(handle),
    scheduleTask: (callback, delayMs = 0) => window.setTimeout(callback, delayMs),
    cancelTask: (handle) => window.clearTimeout(handle),
  };
};

/**
 * Waits for the skeleton's buffered first-contentful-paint, then resumes in a
 * later task. Browsers without Paint Timing use a cancellable double-rAF and
 * task fallback; if rAF itself is unavailable, the fallback is task-only.
 */
export const waitForPaintHandoff = (
  signal?: AbortSignal,
  scheduler: PaintHandoffScheduler = browserPaintHandoffScheduler(),
): Promise<void> => new Promise((resolve, reject) => {
  let settled = false;
  let completionScheduled = false;
  let stopObserving = (): void => undefined;
  let firstFrame: number | null = null;
  let secondFrame: number | null = null;
  let completionTask: number | null = null;

  const stopObserver = (): void => {
    const stop = stopObserving;
    stopObserving = () => undefined;
    try {
      stop();
    } catch {
      // Observation cleanup is not a bootstrap dependency.
    }
  };
  const cancelFrame = (handle: number | null): void => {
    if (handle === null || !scheduler.cancelFrame) return;
    try {
      scheduler.cancelFrame(handle);
    } catch {
      // A broken cleanup primitive must not strand the bootstrap promise.
    }
  };
  const cancelTask = (handle: number | null): void => {
    if (handle === null) return;
    try {
      scheduler.cancelTask(handle);
    } catch {
      // A broken cleanup primitive must not strand the bootstrap promise.
    }
  };
  const cleanup = (): void => {
    stopObserver();
    cancelFrame(firstFrame);
    cancelFrame(secondFrame);
    cancelTask(completionTask);
    firstFrame = null;
    secondFrame = null;
    completionTask = null;
    signal?.removeEventListener('abort', handleAbort);
  };
  const rejectOnce = (error: unknown): void => {
    if (settled) return;
    settled = true;
    cleanup();
    reject(error);
  };
  const handleAbort = (): void => {
    rejectOnce(new BootstrapCancelledError());
  };

  const completeInNextTask = (): void => {
    if (settled || completionScheduled) return;
    completionScheduled = true;
    stopObserver();
    cancelFrame(firstFrame);
    cancelFrame(secondFrame);
    firstFrame = null;
    secondFrame = null;
    try {
      completionTask = scheduler.scheduleTask(() => {
        completionTask = null;
        if (signal?.aborted) {
          handleAbort();
          return;
        }
        if (settled) return;
        settled = true;
        cleanup();
        markBootstrapPerformance(BOOTSTRAP_PERFORMANCE_MARKS.paintHandoffComplete);
        resolve();
      }, 0);
    } catch (error: unknown) {
      rejectOnce(error);
    }
  };

  const startFeatureFallback = (): void => {
    stopObserver();
    if (!scheduler.requestFrame) {
      completeInNextTask();
      return;
    }
    try {
      firstFrame = scheduler.requestFrame(() => {
        firstFrame = null;
        if (signal?.aborted) {
          handleAbort();
          return;
        }
        try {
          secondFrame = scheduler.requestFrame?.(() => {
            secondFrame = null;
            completeInNextTask();
          }) ?? null;
        } catch {
          completeInNextTask();
        }
      });
    } catch {
      completeInNextTask();
    }
  };

  if (signal?.aborted) {
    handleAbort();
    return;
  }
  signal?.addEventListener('abort', handleAbort, { once: true });
  try {
    if (scheduler.firstContentfulPaintRecorded()) {
      completeInNextTask();
      return;
    }
    if (!scheduler.observeFirstContentfulPaint) {
      startFeatureFallback();
      return;
    }
    stopObserving = scheduler.observeFirstContentfulPaint(completeInNextTask);
  } catch {
    startFeatureFallback();
  }
});

export interface EditorBootstrapSteps {
  readonly waitForPaintHandoff: (signal?: AbortSignal) => Promise<void>;
  readonly loadTinyMce: () => Promise<unknown>;
  readonly initialise: (signal?: AbortSignal) => Promise<void>;
}

export class BootstrapCancelledError extends Error {
  public constructor() {
    super('Editor bootstrap was cancelled');
    this.name = 'BootstrapCancelledError';
  }
}

export const isBootstrapCancelled = (error: unknown): error is BootstrapCancelledError =>
  error instanceof BootstrapCancelledError;

const throwIfCancelled = (signal?: AbortSignal): void => {
  if (signal?.aborted) throw new BootstrapCancelledError();
};

export const runEditorBootstrap = async (
  steps: EditorBootstrapSteps,
  signal?: AbortSignal,
): Promise<void> => {
  try {
    throwIfCancelled(signal);
    await steps.waitForPaintHandoff(signal);
    throwIfCancelled(signal);
    await steps.loadTinyMce();
    throwIfCancelled(signal);
    markBootstrapPerformance(BOOTSTRAP_PERFORMANCE_MARKS.initialiseStarted);
    await steps.initialise(signal);
    throwIfCancelled(signal);
    markBootstrapPerformance(BOOTSTRAP_PERFORMANCE_MARKS.editorReady);
  } catch (error: unknown) {
    throwIfCancelled(signal);
    throw error;
  }
};

export interface BootstrapFailureHandlers {
  readonly destroy: () => void;
  readonly showFatal: (error: unknown) => void;
}

export const handleBootstrapFailure = (
  error: unknown,
  handlers: BootstrapFailureHandlers,
): void => {
  handlers.destroy();
  if (!isBootstrapCancelled(error)) handlers.showFatal(error);
};

export type FatalErrorLogger = (message: string, error: unknown) => void;

export const showFatalError = (
  error: unknown,
  failedStatus: string,
  root: Document = document,
  log: FatalErrorLogger = (message, cause) => console.error(message, cause),
): void => {
  log('Editor initialisation failed', error);
  const shell = root.getElementById('app');
  const loading = root.getElementById('loading-skeleton');
  const errorElement = root.getElementById('app-error');
  const statusElement = root.getElementById('app-status');
  if (loading instanceof HTMLElement) loading.hidden = true;
  if (errorElement instanceof HTMLElement) {
    errorElement.classList.remove('bootstrap-fallback');
    errorElement.hidden = false;
  }
  if (shell instanceof HTMLElement) {
    shell.classList.add('has-fatal-error');
    shell.setAttribute('aria-busy', 'false');
  }
  if (statusElement instanceof HTMLElement) statusElement.textContent = failedStatus;
};
