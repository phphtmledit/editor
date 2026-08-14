/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createDraftAutosave,
  DRAFT_AUTOSAVE_INTERVAL_MS,
  DRAFT_MAX_BYTES,
  DRAFT_STORAGE_KEY,
  loadDraft,
  parseStoredDraft,
  saveDraft,
  type DraftStorage,
} from '../../src/storage/draft';

const memoryStorage = (): DraftStorage & { values: Map<string, string> } => {
  const values = new Map<string, string>();
  return {
    values,
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => {
      values.set(key, value);
    },
  };
};

afterEach(() => {
  vi.useRealTimers();
});

describe('versioned draft storage', () => {
  it('accepts exactly 1 MiB of UTF-8 and rejects one byte more without replacing the last draft', () => {
    const storage = memoryStorage();
    const exact = 'é'.repeat(DRAFT_MAX_BYTES / 2);
    const first = saveDraft(exact, storage, () => 10);
    const stored = storage.values.get(DRAFT_STORAGE_KEY);

    expect(first).toMatchObject({ status: 'saved', bytes: DRAFT_MAX_BYTES });
    expect(stored).toBeDefined();

    const oversized = saveDraft(`${exact}x`, storage, () => 20);
    expect(oversized).toEqual({
      status: 'too-large',
      bytes: DRAFT_MAX_BYTES + 1,
      limit: DRAFT_MAX_BYTES,
    });
    expect(storage.values.get(DRAFT_STORAGE_KEY)).toBe(stored);
    expect(loadDraft(storage)).toMatchObject({
      status: 'loaded',
      draft: { html: exact, savedAt: 10 },
    });
  });

  it('treats missing, malformed and invalid records as non-throwing data results', () => {
    expect(parseStoredDraft(null)).toEqual({ status: 'empty' });
    expect(parseStoredDraft(JSON.stringify({ html: '', savedAt: 2 }))).toEqual({ status: 'empty' });
    expect(parseStoredDraft('{')).toEqual({ status: 'invalid' });
    expect(parseStoredDraft(JSON.stringify({ html: 1, savedAt: 2 }))).toEqual({ status: 'invalid' });
    expect(parseStoredDraft(JSON.stringify({ html: 'ok', savedAt: Number.NaN }))).toEqual({
      status: 'invalid',
    });
  });

  it('converts localStorage read and write exceptions into statuses', () => {
    const readFailure: DraftStorage = {
      getItem: () => {
        throw new DOMException('blocked', 'SecurityError');
      },
      setItem: vi.fn(),
    };
    const writeFailure: DraftStorage = {
      getItem: () => null,
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    };

    expect(loadDraft(readFailure)).toEqual({ status: 'storage-error' });
    expect(saveDraft('<p>x</p>', writeFailure)).toEqual({
      status: 'storage-error',
      bytes: 8,
    });
  });
});

describe('draft autosave', () => {
  it('starts only on request, saves every three seconds and skips unchanged HTML', () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    let html = '<p>initial</p>';
    const autosave = createDraftAutosave({
      getHtml: () => html,
      storage,
      initialSavedHtml: html,
      now: () => 100,
    });

    vi.advanceTimersByTime(DRAFT_AUTOSAVE_INTERVAL_MS * 2);
    expect(setItem).not.toHaveBeenCalled();

    autosave.start();
    vi.advanceTimersByTime(DRAFT_AUTOSAVE_INTERVAL_MS);
    expect(setItem).not.toHaveBeenCalled();

    html = '<p>changed</p>';
    vi.advanceTimersByTime(DRAFT_AUTOSAVE_INTERVAL_MS);
    expect(setItem).toHaveBeenCalledOnce();
    vi.advanceTimersByTime(DRAFT_AUTOSAVE_INTERVAL_MS);
    expect(setItem).toHaveBeenCalledOnce();
    autosave.stop();
  });

  it('resumes after an oversized value and exposes a synchronous final save', () => {
    vi.useFakeTimers();
    const storage = memoryStorage();
    const setItem = vi.spyOn(storage, 'setItem');
    let html = 'x'.repeat(DRAFT_MAX_BYTES + 1);
    const autosave = createDraftAutosave({
      getHtml: () => html,
      storage,
      now: () => 200,
    });

    autosave.start();
    vi.advanceTimersByTime(DRAFT_AUTOSAVE_INTERVAL_MS);
    expect(setItem).not.toHaveBeenCalled();
    expect(autosave.isRunning()).toBe(true);

    html = '💾 restored';
    expect(autosave.saveFinal()).toMatchObject({
      status: 'saved',
      draft: { html, savedAt: 200 },
    });
    expect(setItem).toHaveBeenCalledOnce();
    expect(autosave.isRunning()).toBe(false);
  });

  it('does not lose retryability after storage or source errors', () => {
    let sourceThrows = true;
    let writeThrows = true;
    const values = new Map<string, string>();
    const storage: DraftStorage = {
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        if (writeThrows) throw new DOMException('full', 'QuotaExceededError');
        values.set(key, value);
      },
    };
    const autosave = createDraftAutosave({
      getHtml: () => {
        if (sourceThrows) throw new Error('editor unavailable');
        return '<p>retry</p>';
      },
      storage,
    });

    expect(autosave.saveNow()).toEqual({ status: 'source-error' });
    sourceThrows = false;
    expect(autosave.saveNow()).toEqual({ status: 'storage-error', bytes: 12 });
    writeThrows = false;
    expect(autosave.saveNow()).toMatchObject({ status: 'saved' });
    expect(autosave.saveNow()).toEqual({ status: 'unchanged', bytes: 12 });
  });
});
