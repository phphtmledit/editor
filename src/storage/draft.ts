/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export const DRAFT_STORAGE_VERSION = 1;
export const DRAFT_STORAGE_KEY = `phphtmledit.draft.v${DRAFT_STORAGE_VERSION}`;
export const DRAFT_MAX_BYTES = 1_048_576;
export const DRAFT_AUTOSAVE_INTERVAL_MS = 3_000;

export interface DraftSnapshot {
  readonly html: string;
  readonly savedAt: number;
}

export interface DraftStorage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
}

export type DraftLoadResult =
  | { readonly status: 'empty' }
  | { readonly status: 'loaded'; readonly draft: DraftSnapshot; readonly bytes: number }
  | { readonly status: 'invalid' }
  | { readonly status: 'too-large'; readonly bytes: number; readonly limit: number }
  | { readonly status: 'storage-error' };

export type DraftSaveResult =
  | { readonly status: 'saved'; readonly draft: DraftSnapshot; readonly bytes: number }
  | { readonly status: 'unchanged'; readonly bytes: number }
  | { readonly status: 'too-large'; readonly bytes: number; readonly limit: number }
  | { readonly status: 'storage-error'; readonly bytes: number }
  | { readonly status: 'source-error' };

export interface DraftAutosaveController {
  start: () => void;
  stop: () => void;
  saveNow: () => DraftSaveResult;
  saveFinal: () => DraftSaveResult;
  isRunning: () => boolean;
}

export interface DraftAutosaveOptions {
  readonly getHtml: () => string;
  readonly storage?: DraftStorage;
  readonly initialSavedHtml?: string;
  readonly intervalMs?: number;
  readonly now?: () => number;
  readonly onResult?: (result: DraftSaveResult) => void;
}

const utf8Bytes = (value: string): number => new TextEncoder().encode(value).byteLength;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const parseStoredDraft = (value: string | null): DraftLoadResult => {
  if (value === null) return { status: 'empty' };

  let parsed: unknown;
  try {
    parsed = JSON.parse(value) as unknown;
  } catch {
    return { status: 'invalid' };
  }

  if (!isRecord(parsed)) return { status: 'invalid' };
  const { html, savedAt } = parsed;
  if (
    typeof html !== 'string' ||
    typeof savedAt !== 'number' ||
    !Number.isFinite(savedAt) ||
    savedAt < 0
  ) {
    return { status: 'invalid' };
  }

  // An empty editor is the absence of a recoverable draft, not a document the
  // user should be told was restored on the next visit.
  if (html === '') return { status: 'empty' };

  const bytes = utf8Bytes(html);
  if (bytes > DRAFT_MAX_BYTES) {
    return { status: 'too-large', bytes, limit: DRAFT_MAX_BYTES };
  }

  return { status: 'loaded', draft: { html, savedAt }, bytes };
};

export const loadDraft = (storage?: DraftStorage): DraftLoadResult => {
  try {
    const target = storage ?? globalThis.localStorage;
    return parseStoredDraft(target.getItem(DRAFT_STORAGE_KEY));
  } catch {
    return { status: 'storage-error' };
  }
};

export const saveDraft = (
  html: string,
  storage?: DraftStorage,
  now: () => number = Date.now,
): DraftSaveResult => {
  const bytes = utf8Bytes(html);
  if (bytes > DRAFT_MAX_BYTES) {
    return { status: 'too-large', bytes, limit: DRAFT_MAX_BYTES };
  }

  const draft: DraftSnapshot = { html, savedAt: now() };
  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft));
    return { status: 'saved', draft, bytes };
  } catch {
    return { status: 'storage-error', bytes };
  }
};

export const createDraftAutosave = (
  options: DraftAutosaveOptions,
): DraftAutosaveController => {
  const intervalMs = options.intervalMs ?? DRAFT_AUTOSAVE_INTERVAL_MS;
  let interval: ReturnType<typeof setInterval> | null = null;
  let lastSavedHtml = options.initialSavedHtml;

  const saveNow = (): DraftSaveResult => {
    let html: string;
    try {
      html = options.getHtml();
    } catch {
      const result: DraftSaveResult = { status: 'source-error' };
      options.onResult?.(result);
      return result;
    }

    const bytes = utf8Bytes(html);
    if (html === lastSavedHtml) {
      const result: DraftSaveResult = { status: 'unchanged', bytes };
      options.onResult?.(result);
      return result;
    }

    const result = saveDraft(html, options.storage, options.now);
    if (result.status === 'saved') lastSavedHtml = html;
    options.onResult?.(result);
    return result;
  };

  const stop = (): void => {
    if (interval === null) return;
    clearInterval(interval);
    interval = null;
  };

  return {
    start: () => {
      if (interval !== null) return;
      interval = setInterval(saveNow, intervalMs);
    },
    stop,
    saveNow,
    saveFinal: () => {
      stop();
      return saveNow();
    },
    isRunning: () => interval !== null,
  };
};
