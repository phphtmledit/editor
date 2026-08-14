/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { applyReplaceRule } from './engine';
import type { RegexWorkerRequest, RegexWorkerResponse } from './worker-protocol';

interface RegexWorkerScope {
  onmessage: ((event: MessageEvent<RegexWorkerRequest>) => void) | null;
  postMessage: (response: RegexWorkerResponse) => void;
}

const workerScope = globalThis as unknown as RegexWorkerScope;

workerScope.onmessage = (event): void => {
  try {
    workerScope.postMessage({
      ok: true,
      result: applyReplaceRule(event.data.html, event.data.rule),
    });
  } catch {
    workerScope.postMessage({ ok: false });
  }
};
