/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import type { SourceEditorController } from './source';
import type { VisualEditorController } from './visual';
import {
  createProgrammaticMutationGuard,
  type ProgrammaticMutationGuard,
} from './mutation-guard';

type Panel = 'visual' | 'source';

export interface SyncController {
  flushActive: () => void;
  destroy: () => void;
}

interface PendingSync {
  timer: ReturnType<typeof setTimeout>;
  revision: number;
  token: number;
}

const NOTICE_KEY = 'phphtmledit.normalization-notice.v1';

const hasShownNotice = (): boolean => {
  try {
    return localStorage.getItem(NOTICE_KEY) === 'shown';
  } catch {
    return false;
  }
};

const rememberNotice = (): void => {
  try {
    localStorage.setItem(NOTICE_KEY, 'shown');
  } catch {
    // Storage may be unavailable in privacy-restricted contexts.
  }
};

export const createSyncController = (
  visual: VisualEditorController,
  source: SourceEditorController,
  showNormalizationNotice: () => void,
  mutationGuard: ProgrammaticMutationGuard = createProgrammaticMutationGuard(),
): SyncController => {
  let authority: Panel | null = null;
  let disposed = false;
  let nextToken = 0;
  let normalizationNoticeShown = hasShownNotice();
  let sourceProjection: { raw: string; normalized: string; userAuthored: boolean } | null = null;
  const revisions: Record<Panel, number> = { visual: 0, source: 0 };
  const pending: Record<Panel, PendingSync | null> = { visual: null, source: null };
  const unsubscribers: Array<() => void> = [];

  const cancel = (panel: Panel): void => {
    const current = pending[panel];
    if (current) clearTimeout(current.timer);
    pending[panel] = null;
  };

  unsubscribers.push(mutationGuard.onStart(() => {
    cancel('visual');
    cancel('source');
    sourceProjection = null;
  }));

  const applyVisualToSource = (): void => {
    const html = visual.getHtml();
    if (source.getHtml() !== html) mutationGuard.run(() => source.setHtml(html));
    sourceProjection = null;
  };

  const applySourceToVisual = (): void => {
    const raw = source.getHtml();
    if (sourceProjection?.raw === raw && visual.getHtml() === sourceProjection.normalized) return;

    let normalized = visual.getHtml();
    if (normalized !== raw) {
      mutationGuard.run(() => {
        normalized = visual.setHtml(raw);
      });
    }
    sourceProjection = { raw, normalized, userAuthored: true };
  };

  const flush = (panel: Panel): void => {
    cancel(panel);
    if (disposed || authority !== panel) return;
    if (panel === 'visual') applyVisualToSource();
    else applySourceToVisual();
  };

  const schedule = (panel: Panel, delay: number): void => {
    cancel(panel);
    revisions[panel] += 1;
    const revision = revisions[panel];
    const token = ++nextToken;
    const timer = setTimeout(() => {
      const current = pending[panel];
      if (
        disposed ||
        authority !== panel ||
        !current ||
        current.revision !== revision ||
        current.token !== token
      ) return;
      pending[panel] = null;
      if (panel === 'visual') applyVisualToSource();
      else applySourceToVisual();
    }, delay);
    pending[panel] = { timer, revision, token };
  };

  const enter = (next: Panel): void => {
    if (disposed || mutationGuard.isActive()) return;
    const previous = authority;
    if (previous && previous !== next) flush(previous);
    authority = next;
    if (next === 'visual') {
      adoptVisualNormalization();
      queueMicrotask(() => adoptVisualNormalization());
    }
  };

  const leave = (panel: Panel): void => {
    queueMicrotask(() => {
      if (disposed || authority !== panel) return;
      const stillFocused = panel === 'visual' ? visual.hasFocus() : source.hasFocus();
      if (stillFocused) return;

      const other: Panel = panel === 'visual' ? 'source' : 'visual';
      const otherFocused = other === 'visual' ? visual.hasFocus() : source.hasFocus();
      if (otherFocused) {
        enter(other);
        return;
      }

      flush(panel);
      requestAnimationFrame(() => {
        if (disposed || authority !== panel) return;
        const lateOtherFocus = other === 'visual' ? visual.hasFocus() : source.hasFocus();
        if (lateOtherFocus) enter(other);
      });
    });
  };

  function adoptVisualNormalization(): void {
    if (authority !== 'visual' || !sourceProjection?.userAuthored) return;
    const { raw, normalized } = sourceProjection;
    if (raw !== normalized && source.getHtml() === raw) {
      mutationGuard.run(() => source.setHtml(normalized));
      if (!normalizationNoticeShown) {
        normalizationNoticeShown = true;
        rememberNotice();
        showNormalizationNotice();
      }
    }
    sourceProjection = null;
  }

  unsubscribers.push(
    visual.onFocus(() => enter('visual')),
    visual.onBlur(() => leave('visual')),
    visual.onChange(() => {
      if (!disposed && !mutationGuard.isActive() && authority === 'visual') schedule('visual', 300);
    }),
    source.onFocus(() => enter('source')),
    source.onBlur(() => leave('source')),
    source.onChange(() => {
      if (!disposed && !mutationGuard.isActive() && authority === 'source') schedule('source', 500);
    }),
  );

  if (visual.hasFocus()) enter('visual');
  else if (source.hasFocus()) enter('source');

  return {
    flushActive: () => {
      if (authority) flush(authority);
    },
    destroy: () => {
      if (disposed) return;
      disposed = true;
      cancel('visual');
      cancel('source');
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    },
  };
};
