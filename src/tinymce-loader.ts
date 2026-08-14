/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import type { TinyMCE } from 'tinymce';
import {
  BOOTSTRAP_PERFORMANCE_MARKS,
  markBootstrapPerformance,
} from './bootstrap';

export const TINYMCE_RUNTIME_URL = '/tinymce/tinymce.min.js?v=8.8.2';

const LOADER_ATTRIBUTE = 'data-phe-tinymce-runtime';
const STATE_ATTRIBUTE = 'data-phe-tinymce-state';

type TinyWindow = Window & { readonly tinymce?: TinyMCE };

let pendingRuntime: Promise<TinyMCE> | null = null;

const currentTinyMce = (): TinyMCE | null => {
  const candidate = (window as TinyWindow).tinymce;
  return candidate && typeof candidate.init === 'function' ? candidate : null;
};

const runtimeScript = (): HTMLScriptElement | null => {
  const absoluteRuntimeUrl = new URL(TINYMCE_RUNTIME_URL, document.baseURI).href;
  return Array.from(document.scripts).find((script) =>
    script.getAttribute('src') === TINYMCE_RUNTIME_URL || script.src === absoluteRuntimeUrl) ?? null;
};

const loadedRuntime = (tiny: TinyMCE): Promise<TinyMCE> => {
  markBootstrapPerformance(BOOTSTRAP_PERFORMANCE_MARKS.tinyRuntimeLoaded);
  return Promise.resolve(tiny);
};

/** Loads the self-hosted TinyMCE runtime once and shares in-flight work. */
export const loadTinyMce = (): Promise<TinyMCE> => {
  if (pendingRuntime) return pendingRuntime;
  const existingTiny = currentTinyMce();
  if (existingTiny) {
    pendingRuntime = loadedRuntime(existingTiny);
    return pendingRuntime;
  }

  const pending = new Promise<TinyMCE>((resolve, reject) => {
    let script = runtimeScript();
    if (script) {
      const loaderOwned = script.getAttribute(LOADER_ATTRIBUTE) === 'true';
      const state = script.getAttribute(STATE_ATTRIBUTE);
      if (!loaderOwned) {
        reject(new Error('Refusing to adopt an unmanaged TinyMCE runtime script'));
        return;
      }
      if (state === 'failed') {
        script.remove();
        script = null;
      } else if (state === 'loaded') {
        script.setAttribute(STATE_ATTRIBUTE, 'failed');
        script.remove();
        reject(new Error('TinyMCE runtime script completed without a valid global'));
        return;
      } else if (state !== 'loading') {
        reject(new Error(`TinyMCE runtime script has an invalid loader state: ${state ?? 'missing'}`));
        return;
      }
    }

    const insertedByLoader = script === null;
    if (!script) {
      script = document.createElement('script');
      script.src = TINYMCE_RUNTIME_URL;
      script.async = true;
      script.setAttribute(LOADER_ATTRIBUTE, 'true');
      script.setAttribute(STATE_ATTRIBUTE, 'loading');
    }

    const runtimeElement = script;
    let settled = false;

    const cleanup = (): void => {
      runtimeElement.removeEventListener('load', handleLoad);
      runtimeElement.removeEventListener('error', handleError);
    };
    const fail = (message: string): void => {
      if (settled) return;
      settled = true;
      cleanup();
      runtimeElement.setAttribute(STATE_ATTRIBUTE, 'failed');
      if (runtimeElement.getAttribute(LOADER_ATTRIBUTE) === 'true') runtimeElement.remove();
      reject(new Error(message));
    };
    const handleLoad = (): void => {
      const tiny = currentTinyMce();
      if (!tiny) {
        fail('TinyMCE runtime loaded without exposing window.tinymce');
        return;
      }
      if (settled) return;
      settled = true;
      cleanup();
      runtimeElement.setAttribute(STATE_ATTRIBUTE, 'loaded');
      markBootstrapPerformance(BOOTSTRAP_PERFORMANCE_MARKS.tinyRuntimeLoaded);
      resolve(tiny);
    };
    const handleError = (): void => {
      fail(`TinyMCE runtime failed to load from ${TINYMCE_RUNTIME_URL}`);
    };

    runtimeElement.addEventListener('load', handleLoad);
    runtimeElement.addEventListener('error', handleError);

    if (insertedByLoader) {
      document.head.append(runtimeElement);
      markBootstrapPerformance(BOOTSTRAP_PERFORMANCE_MARKS.tinyScriptInserted);
    }
  });

  pendingRuntime = pending;
  void pending.catch(() => {
    if (pendingRuntime === pending) pendingRuntime = null;
  });
  return pending;
};
