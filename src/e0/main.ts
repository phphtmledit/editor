/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import type { Editor, TinyMCE } from 'tinymce';
import { loadMammoth } from './mammoth-runtime';
import './style.css';

declare const __E0_DIAGNOSTIC__: boolean;

const EXPECTED_PLUGINS = [
  'lists',
  'link',
  'image',
  'table',
  'charmap',
  'emoticons',
  'insertdatetime',
] as const;

interface DocxSmokeResult {
  matched: boolean;
  messages: Array<{ type: string; message: string }>;
  html: string;
}

interface NetworkRequest {
  url: string;
  status: number;
  initiatorType: string;
  context: 'page' | 'editor-frame';
}

interface E0State {
  ready: boolean;
  version: string;
  plugins: Record<string, boolean>;
  fullscreenRegistered: boolean;
  readOnly: boolean;
  warnings: string[];
  errors: string[];
  licenseNotifications: string[];
  loadMammoth: () => Promise<void>;
  runDocxSmoke: () => Promise<DocxSmokeResult>;
}

declare global {
  interface Window {
    tinymce: TinyMCE;
    __E0__: E0State;
  }
}

const byId = <T extends HTMLElement>(id: string): T => {
  const element = document.getElementById(id);
  if (!(element instanceof HTMLElement)) {
    throw new Error(`Missing required element #${id}`);
  }
  return element as T;
};

const runtimeLog = byId<HTMLOListElement>('runtime-log');
const tinyStatus = byId<HTMLElement>('tiny-status');
const licenseStatus = byId<HTMLElement>('license-status');
const pluginStatus = byId<HTMLElement>('plugin-status');
const networkStatus = byId<HTMLElement>('network-status');
const docxStatus = byId<HTMLOutputElement>('docx-status');
const docxButton = byId<HTMLButtonElement>('docx-smoke');
const sourceLink = byId<HTMLAnchorElement>('source-link');
const networkColdJson = byId<HTMLPreElement>('network-cold-json');
const networkFullJson = byId<HTMLPreElement>('network-full-json');

sourceLink.href = import.meta.env.VITE_SOURCE_URL || 'https://github.com/phphtmledit/editor';

const warnings: string[] = [];
const errors: string[] = [];
const loadDiagnosticSmoke = __E0_DIAGNOSTIC__
  ? () => import('./docx-diagnostic')
  : null;

const stringifyLogPart = (part: unknown): string => {
  if (part instanceof Error) return `${part.name}: ${part.message}`;
  if (typeof part === 'string') return part;
  try {
    return JSON.stringify(part);
  } catch {
    return String(part);
  }
};

const appendLog = (label: string, value: string, passed = true): void => {
  const item = document.createElement('li');
  item.className = passed ? 'pass' : 'fail';
  const name = document.createElement('strong');
  name.textContent = `${label}: `;
  item.append(name, document.createTextNode(value));
  runtimeLog.append(item);
};

const originalWarn = console.warn.bind(console);
const originalError = console.error.bind(console);

console.warn = (...parts: unknown[]): void => {
  warnings.push(parts.map(stringifyLogPart).join(' '));
  originalWarn(...parts);
};

console.error = (...parts: unknown[]): void => {
  errors.push(parts.map(stringifyLogPart).join(' '));
  originalError(...parts);
};

const performanceRequests = (
  timeline: Performance,
  context: NetworkRequest['context'],
  includeNavigation: boolean,
): NetworkRequest[] => {
  const entries: PerformanceResourceTiming[] = [
    ...(includeNavigation
      ? timeline.getEntriesByType('navigation') as PerformanceNavigationTiming[]
      : []),
    ...timeline.getEntriesByType('resource') as PerformanceResourceTiming[],
  ];

  return entries
    .filter((entry) => /^https?:/i.test(entry.name))
    .map((entry) => ({
      url: entry.name,
      status: entry.responseStatus,
      initiatorType: entry.entryType === 'navigation' ? 'navigation' : entry.initiatorType,
      context,
    }));
};

const captureNetworkRequests = (): NetworkRequest[] => {
  const requests = performanceRequests(window.performance, 'page', true);

  for (const frame of document.querySelectorAll<HTMLIFrameElement>('iframe')) {
    try {
      if (frame.contentWindow) {
        requests.push(...performanceRequests(frame.contentWindow.performance, 'editor-frame', false));
      }
    } catch {
      // A future cross-origin frame must not break the diagnostic capture.
    }
  }

  return requests;
};

const writeNetworkCapture = (target: HTMLPreElement): NetworkRequest[] => {
  const requests = captureNetworkRequests();
  target.textContent = JSON.stringify({
    pageUrl: window.location.href,
    capturedAt: new Date().toISOString(),
    requests,
  });
  return requests;
};

const loadMammothForMeasurement = async (): Promise<void> => {
  await loadMammoth();
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  writeNetworkCapture(networkFullJson);
};

if (!__E0_DIAGNOSTIC__) {
  // Production E0 measurement control: loads the same lazy runtime used by
  // DOCX import without bundling or requesting diagnostic fixtures.
  docxButton.hidden = false;
  docxButton.disabled = true;
  docxButton.textContent = 'Load DOCX runtime';
  docxButton.addEventListener('click', () => {
    docxButton.disabled = true;
    void loadMammothForMeasurement()
      .then(() => {
        docxStatus.textContent = 'Production DOCX runtime loaded; fixtures excluded';
        docxStatus.className = 'pass-text';
      })
      .catch((error: unknown) => {
        docxStatus.textContent = `DOCX runtime load failed: ${stringifyLogPart(error)}`;
        docxStatus.className = 'fail-text';
      });
  });
}

const runDocxSmoke = async (): Promise<DocxSmokeResult> => {
  if (!loadDiagnosticSmoke) {
    throw new Error('DOCX fixtures are available only in the E0 diagnostic build');
  }

  docxButton.disabled = true;
  docxStatus.textContent = 'Parsing DOCX…';

  try {
    const { runFixtureSmoke } = await loadDiagnosticSmoke();
    const result = await runFixtureSmoke();
    const { matched, messages } = result;

    docxStatus.textContent = matched && messages.length === 0
      ? 'DOCX matches golden output'
      : 'DOCX mismatch or warnings';
    docxStatus.className = matched && messages.length === 0 ? 'pass-text' : 'fail-text';
    appendLog('DOCX golden comparison', matched ? 'exact semantic match' : 'mismatch', matched);
    appendLog('Mammoth messages', String(messages.length), messages.length === 0);
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    writeNetworkCapture(networkFullJson);

    return result;
  } finally {
    docxButton.disabled = false;
  }
};

window.__E0__ = {
  ready: false,
  version: '',
  plugins: {},
  fullscreenRegistered: false,
  readOnly: true,
  warnings,
  errors,
  licenseNotifications: [],
  loadMammoth: loadMammothForMeasurement,
  runDocxSmoke,
};

if (__E0_DIAGNOSTIC__) {
  docxButton.addEventListener('click', () => {
    void runDocxSmoke().catch((error: unknown) => {
      const message = stringifyLogPart(error);
      docxStatus.textContent = 'DOCX smoke test failed';
      docxStatus.className = 'fail-text';
      appendLog('DOCX error', message, false);
    });
  });
} else {
  docxStatus.textContent = 'Production build: test fixtures excluded';
}

const initialise = async (): Promise<void> => {
  const tiny = window.tinymce;
  // TinyMCE otherwise loads its full default pack before a named custom pack.
  // Registering the intentionally empty base through the public IconManager API
  // leaves icons_url as the only icon request; the custom pack is visually gated.
  if (!tiny.IconManager.has('default')) tiny.IconManager.add('default', { icons: {} });
  const editors: Editor[] = await tiny.init({
    selector: '#e0-editor',
    base_url: '/tinymce',
    suffix: '.min',
    license_key: 'gpl',
    theme: 'silver',
    model: 'dom',
    icons: 'phphtmledit',
    icons_url: '/tinymce/icons/phphtmledit/icons.min.js',
    emoticons_database_url: '/tinymce/plugins/emoticons/js/emojis-common.min.js',
    emoticons_database_id: 'tinymce.plugins.emoticons',
    cache_suffix: '?v=8.8.2',
    language: 'en',
    skin: 'oxide',
    content_css: 'default',
    plugins: [...EXPECTED_PLUGINS],
    toolbar:
      'undo redo | blocks | bold italic underline strikethrough | forecolor backcolor | ' +
      'alignleft aligncenter alignright alignjustify | bullist numlist outdent indent | ' +
      'link image hr table | charmap emoticons insertdatetime | removeformat',
    block_formats:
      'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; ' +
      'Quote=blockquote; Preformatted=pre',
    promotion: false,
    branding: false,
    xss_sanitization: true,
    automatic_uploads: false,
    height: 470,
  });

  const editor = editors[0];
  if (!editor) throw new Error('TinyMCE did not return an editor instance');

  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

  const plugins = Object.fromEntries(
    EXPECTED_PLUGINS.map((name) => [name, tiny.PluginManager.get(name) !== undefined]),
  );
  const fullscreenRegistered = tiny.PluginManager.get('fullscreen') !== undefined;
  const licenseNotifications = Array.from(document.querySelectorAll<HTMLElement>('.tox-notification'))
    .map((node) => node.innerText.trim())
    .filter((text) => /license|api key|gpl/i.test(text));
  const version = `${tiny.majorVersion}.${tiny.minorVersion}`;
  const allPluginsLoaded = Object.values(plugins).every(Boolean);
  const readOnly = editor.mode.isReadOnly();
  const licenseWarnings = [...warnings, ...errors].filter((message) => /license|api key|gpl/i.test(message));
  const gplAccepted = !readOnly && licenseNotifications.length === 0 && licenseWarnings.length === 0;

  window.__E0__ = {
    ready: true,
    version,
    plugins,
    fullscreenRegistered,
    readOnly,
    warnings,
    errors,
    licenseNotifications,
    loadMammoth: loadMammothForMeasurement,
    runDocxSmoke,
  };

  tinyStatus.textContent = version;
  tinyStatus.className = version === '8.8.2' ? 'pass-text' : 'fail-text';
  licenseStatus.textContent = gplAccepted ? 'Accepted' : 'Failed';
  licenseStatus.className = gplAccepted ? 'pass-text' : 'fail-text';
  pluginStatus.textContent = allPluginsLoaded && !fullscreenRegistered ? '7/7, no fullscreen' : 'Failed';
  pluginStatus.className = allPluginsLoaded && !fullscreenRegistered ? 'pass-text' : 'fail-text';
  window.setTimeout(() => {
    const coldRequests = writeNetworkCapture(networkColdJson);
    const localOnly = coldRequests.every(
      (request) => new URL(request.url).origin === window.location.origin,
    );
    networkStatus.textContent = `${coldRequests.length} local requests`;
    networkStatus.className = localOnly ? 'pass-text' : 'fail-text';
    docxButton.disabled = false;
  }, 750);

  appendLog('TinyMCE version', version, version === '8.8.2');
  appendLog('GPL mode', gplAccepted ? 'accepted, editor editable' : 'warning or read-only state', gplAccepted);
  appendLog('Open-source plugins', `${Object.values(plugins).filter(Boolean).length}/${EXPECTED_PLUGINS.length}`, allPluginsLoaded);
  appendLog('Fullscreen plugin', fullscreenRegistered ? 'unexpectedly registered' : 'absent', !fullscreenRegistered);
  appendLog('Captured console warnings', String(warnings.length), warnings.length === 0);
  appendLog('Captured console errors', String(errors.length), errors.length === 0);
};

void initialise().catch((error: unknown) => {
  const message = stringifyLogPart(error);
  tinyStatus.textContent = 'Initialization failed';
  tinyStatus.className = 'fail-text';
  appendLog('Initialization error', message, false);
  originalError(error);
});
