import { createHash } from 'node:crypto';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import {
  CUSTOM_EMOTICONS_DATABASE_ASSET,
  STOCK_EMOTICONS_DATABASE_ASSET,
  TINYMCE_ASSETS,
} from './tinymce-assets.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const distRoot = resolve(projectRoot, 'dist');
const reportsRoot = resolve(projectRoot, 'reports');
const expectedOrigin = 'http://127.0.0.1:4173';
const failures = [];
const BYTE_BUDGETS = Object.freeze({
  cold: Object.freeze({ gzip: 600_000, brotli: 500_000 }),
  cumulative: Object.freeze({ gzip: 750_000, brotli: 630_000 }),
});
const COLD_REQUEST_BUDGET = 25;

const REQUIRED_COLD_PATHS = [
  '/',
  '/tinymce/tinymce.min.js',
  '/tinymce/themes/silver/theme.min.js',
  '/tinymce/icons/phphtmledit/icons.min.js',
  '/tinymce/models/dom/model.min.js',
  '/tinymce/plugins/lists/plugin.min.js',
  '/tinymce/plugins/link/plugin.min.js',
  '/tinymce/plugins/image/plugin.min.js',
  '/tinymce/plugins/table/plugin.min.js',
  '/tinymce/plugins/charmap/plugin.min.js',
  '/tinymce/plugins/insertdatetime/plugin.min.js',
  '/tinymce/plugins/emoticons/plugin.min.js',
  `/tinymce/${CUSTOM_EMOTICONS_DATABASE_ASSET}`,
  '/tinymce/skins/ui/oxide/skin.min.css',
  '/tinymce/skins/ui/oxide/content.min.css',
  '/tinymce/skins/content/default/content.min.css',
];

const [
  coldReport,
  cumulativeReport,
  manifestBytes,
  distAssetNames,
  distNames,
  docxFixtureBytes,
] = await Promise.all([
  readFile(resolve(reportsRoot, 'network-e3-cold.json'), 'utf8').then(JSON.parse),
  readFile(resolve(reportsRoot, 'network-e3-cumulative.json'), 'utf8').then(JSON.parse),
  readFile(resolve(distRoot, '.vite', 'manifest.json')),
  readdir(resolve(distRoot, 'assets')),
  readdir(distRoot, { recursive: true }),
  readFile(resolve(projectRoot, 'tests', 'fixtures', 'mammoth-fixture.docx')),
]);
const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');
const docxFixtureSha256 = createHash('sha256').update(docxFixtureBytes).digest('hex');
const manifest = JSON.parse(manifestBytes.toString('utf8'));
const appEntry = manifest['index.html'];
const sourceRichEntry = manifest['src/editor/source-rich.ts'];
const safeReplaceEntry = manifest['src/replace/safe.ts'];
const mammothEntry = manifest['src/import/mammoth-browser.ts'];
const dynamicEntryKeys = Object.entries(manifest)
  .filter(([, entry]) => entry?.isDynamicEntry === true)
  .map(([key]) => key)
  .sort();
const expectedDynamicEntryKeys = [
  'src/editor/source-rich.ts',
  'src/replace/safe.ts',
  'src/import/mammoth-browser.ts',
].sort();
const regexWorkerAssetNames = distAssetNames.filter((name) => /^regex-worker-[\w-]+\.js$/i.test(name));
const distFixtureNames = distNames.filter((name) => /(?:\.docx$|fixture)/i.test(name));
const normalizedDistNames = distNames.map((name) => name.replaceAll('\\', '/'));

if (!appEntry?.isEntry || typeof appEntry.file !== 'string') {
  failures.push('dist manifest must contain the product index.html entry');
}
if (!sourceRichEntry?.isDynamicEntry || typeof sourceRichEntry.file !== 'string') {
  failures.push('dist manifest must contain the lazy src/editor/source-rich.ts entry');
}
if (!safeReplaceEntry?.isDynamicEntry || typeof safeReplaceEntry.file !== 'string') {
  failures.push('dist manifest must contain the lazy src/replace/safe.ts entry');
}
if (!mammothEntry?.isDynamicEntry || typeof mammothEntry.file !== 'string') {
  failures.push('dist manifest must contain the lazy src/import/mammoth-browser.ts entry');
}
if (
  !Array.isArray(appEntry?.dynamicImports) ||
  JSON.stringify([...appEntry.dynamicImports].sort()) !== JSON.stringify(expectedDynamicEntryKeys)
) {
  failures.push('product entry must dynamically import only source-rich, safe replacement and Mammoth in E3');
}
if (JSON.stringify(dynamicEntryKeys) !== JSON.stringify(expectedDynamicEntryKeys)) {
  failures.push(`dist manifest must have exactly the three E3 dynamic entries, got ${dynamicEntryKeys.join(', ')}`);
}
if (regexWorkerAssetNames.length !== 1) {
  failures.push(`dist must contain exactly one regex-worker asset, got ${regexWorkerAssetNames.length}`);
}
if (distFixtureNames.length > 0) {
  failures.push(`production dist contains diagnostic fixtures: ${distFixtureNames.join(', ')}`);
}
if (normalizedDistNames.includes(`tinymce/${STOCK_EMOTICONS_DATABASE_ASSET}`)) {
  failures.push('production dist contains the stock TinyMCE emoji database');
}
if (!normalizedDistNames.includes(`tinymce/${CUSTOM_EMOTICONS_DATABASE_ASSET}`)) {
  failures.push('production dist does not contain the custom TinyMCE emoji database');
}
for (const [key, entry] of Object.entries(manifest)) {
  const manifestText = `${key} ${entry?.src ?? ''} ${entry?.file ?? ''}`;
  if (/(?:\.docx|fixture)/i.test(manifestText)) {
    failures.push(`production manifest contains a diagnostic fixture: ${manifestText}`);
  }
}

const assertReportShape = (name, report, scenario) => {
  if (!report || typeof report !== 'object') throw new TypeError(`${name}: report must be an object`);
  if (typeof report.pageUrl !== 'string') throw new TypeError(`${name}: pageUrl must be a string`);
  if (!Array.isArray(report.requests)) throw new TypeError(`${name}: requests must be an array`);
  if (report.requests.length === 0) failures.push(`${name}: network capture is empty`);
  if (typeof report.capturedAt !== 'string' || Number.isNaN(Date.parse(report.capturedAt))) {
    failures.push(`${name}: capturedAt is missing or invalid`);
  }
  if (report.stage !== 'E3') failures.push(`${name}: stage must be E3`);
  if (report.scenario !== scenario) failures.push(`${name}: scenario must be ${scenario}`);
  if (report.manifestSha256 !== manifestSha256) {
    failures.push(`${name}: capture manifest hash does not match current dist`);
  }
  if (report.docxFixtureSha256 !== docxFixtureSha256) {
    failures.push(`${name}: capture DOCX fixture hash does not match tests/fixtures/mammoth-fixture.docx`);
  }
  for (const [index, request] of report.requests.entries()) {
    if (!request || typeof request !== 'object' || typeof request.url !== 'string') {
      throw new TypeError(`${name}: request ${index} has no URL`);
    }
  }
};

assertReportShape('cold', coldReport, 'cold');
assertReportShape('cumulative', cumulativeReport, 'cumulative');

const compressedSizes = (bytes) => ({
  raw: bytes.byteLength,
  gzip: gzipSync(bytes, { level: 9 }).byteLength,
  brotli: brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).byteLength,
});

const pathForUrl = (rawUrl) => {
  const url = new URL(rawUrl);
  if (url.origin !== expectedOrigin) {
    failures.push(`External request: ${url.href}`);
    return null;
  }

  const decoded = decodeURIComponent(url.pathname);
  const file = decoded === '/' ? resolve(distRoot, 'index.html') : resolve(distRoot, `.${decoded}`);
  const fromDist = relative(distRoot, file);
  if (fromDist.startsWith('..') || isAbsolute(fromDist)) {
    failures.push(`Unsafe request path: ${url.href}`);
    return null;
  }
  return file;
};

const analyseScenario = async (name, report) => {
  if (new URL(report.pageUrl).origin !== expectedOrigin) {
    failures.push(`${name}: unexpected page origin ${report.pageUrl}`);
  }

  const rows = [];
  for (const request of report.requests) {
    if (!Number.isInteger(request.status) || request.status < 200 || request.status >= 400) {
      failures.push(`${name}: HTTP ${request.status}: ${request.url}`);
    }

    const file = pathForUrl(request.url);
    if (!file) continue;

    try {
      const bytes = await readFile(file);
      rows.push({
        url: request.url,
        path: relative(distRoot, file).replaceAll('\\', '/'),
        status: request.status,
        initiatorType: request.initiatorType,
        context: request.context,
        sha256: createHash('sha256').update(bytes).digest('hex'),
        ...compressedSizes(bytes),
      });
    } catch {
      failures.push(`${name}: requested URL has no current file in dist: ${request.url}`);
    }
  }

  return rows;
};

const [coldRows, cumulativeRows] = await Promise.all([
  analyseScenario('cold', coldReport),
  analyseScenario('cumulative', cumulativeReport),
]);

const pathname = ({ url }) => new URL(url).pathname;
const isDiagnosticFixturePath = (path) =>
  path.toLowerCase().endsWith('.docx') ||
  /(?:mammoth-fixture|tests\/fixtures)/i.test(path);
const coldPaths = new Set(coldReport.requests.map(pathname));
const coldUrls = new Set(coldReport.requests.map(({ url }) => url));
const cumulativeUrls = new Set(cumulativeReport.requests.map(({ url }) => url));
const appPath = typeof appEntry?.file === 'string' ? `/${appEntry.file}` : null;
const appCssPaths = Array.isArray(appEntry?.css) ? appEntry.css.map((file) => `/${file}`) : [];
const sourceRichPath = typeof sourceRichEntry?.file === 'string' ? `/${sourceRichEntry.file}` : null;
const safeReplacePath = typeof safeReplaceEntry?.file === 'string' ? `/${safeReplaceEntry.file}` : null;
const mammothPath = typeof mammothEntry?.file === 'string' ? `/${mammothEntry.file}` : null;
const regexWorkerPath = regexWorkerAssetNames.length === 1 ? `/assets/${regexWorkerAssetNames[0]}` : null;
const regexWorkerRawSize = regexWorkerPath
  ? (await readFile(resolve(distRoot, `.${regexWorkerPath}`))).byteLength
  : null;
const countPath = (report, expectedPath) =>
  report.requests.filter((request) => pathname(request) === expectedPath).length;

for (const requiredPath of REQUIRED_COLD_PATHS) {
  if (!coldPaths.has(requiredPath)) failures.push(`cold: required request is missing: ${requiredPath}`);
}
if (appPath && countPath(coldReport, appPath) !== 1) {
  failures.push(`cold: expected the manifest application entry exactly once: ${appPath}`);
}
for (const cssPath of appCssPaths) {
  if (countPath(coldReport, cssPath) !== 1) {
    failures.push(`cold: expected the manifest stylesheet exactly once: ${cssPath}`);
  }
}
for (const coldUrl of coldUrls) {
  if (!cumulativeUrls.has(coldUrl)) failures.push(`cumulative: cold request is missing: ${coldUrl}`);
}
const cumulativeOnlyPaths = cumulativeReport.requests
  .filter(({ url }) => !coldUrls.has(url))
  .map(pathname);
if (sourceRichPath && countPath(coldReport, sourceRichPath) !== 0) {
  failures.push(`cold: lazy CodeMirror HTML tools loaded before source focus: ${sourceRichPath}`);
}
if (sourceRichPath && countPath(cumulativeReport, sourceRichPath) !== 1) {
  failures.push(`cumulative: expected lazy CodeMirror HTML tools exactly once: ${sourceRichPath}`);
}
if (safeReplacePath && countPath(coldReport, safeReplacePath) !== 0) {
  failures.push(`cold: safe replacement module loaded before a regex action: ${safeReplacePath}`);
}
if (safeReplacePath && countPath(cumulativeReport, safeReplacePath) !== 1) {
  failures.push(`cumulative: expected safe replacement module exactly once: ${safeReplacePath}`);
}
if (mammothPath && countPath(coldReport, mammothPath) !== 0) {
  failures.push(`cold: Mammoth loaded before a DOCX import: ${mammothPath}`);
}
if (mammothPath && countPath(cumulativeReport, mammothPath) !== 1) {
  failures.push(`cumulative: expected Mammoth exactly once after the DOCX import: ${mammothPath}`);
}
if (regexWorkerPath && countPath(coldReport, regexWorkerPath) !== 0) {
  failures.push(`cold: regex Worker loaded before a regex action: ${regexWorkerPath}`);
}
if (regexWorkerPath && countPath(cumulativeReport, regexWorkerPath) !== 1) {
  failures.push(`cumulative: expected regex Worker exactly once: ${regexWorkerPath}`);
}
const cumulativeOnlyJavaScriptPaths = cumulativeOnlyPaths.filter((path) => path.endsWith('.js')).sort();
const expectedCumulativeOnlyJavaScriptPaths = [
  sourceRichPath,
  safeReplacePath,
  mammothPath,
  regexWorkerPath,
]
  .filter((path) => typeof path === 'string')
  .sort();
if (
  JSON.stringify(cumulativeOnlyJavaScriptPaths) !==
  JSON.stringify(expectedCumulativeOnlyJavaScriptPaths)
) {
  failures.push(
    `cumulative: expected only source-rich, safe, Mammoth and regex-worker JavaScript; got ${cumulativeOnlyJavaScriptPaths.join(', ')}`,
  );
}
if (
  !Array.isArray(cumulativeReport.regexActionRequestPaths) ||
  !safeReplacePath ||
  !regexWorkerPath ||
  !cumulativeReport.regexActionRequestPaths.includes(safeReplacePath) ||
  !cumulativeReport.regexActionRequestPaths.includes(regexWorkerPath)
) {
  failures.push('cumulative: regex action did not request both safe replacement and regex Worker');
}
if (
  !Array.isArray(cumulativeReport.docxImportRequestPaths) ||
  !mammothPath ||
  !cumulativeReport.docxImportRequestPaths.includes(mammothPath)
) {
  failures.push('cumulative: the actual DOCX import did not request the lazy Mammoth chunk');
}
const workerLifecycle = cumulativeReport.workerNetworkLifecycle;
if (
  !Array.isArray(coldReport.workerNetworkLifecycle) ||
  coldReport.workerNetworkLifecycle.length !== 0 ||
  !Array.isArray(workerLifecycle) ||
  workerLifecycle.length !== 1 ||
  workerLifecycle[0]?.terminalEvent !== 'Network.loadingFinished' ||
  workerLifecycle[0]?.status !== 200 ||
  workerLifecycle[0]?.failure !== null ||
  workerLifecycle[0]?.decodedContentSize !== regexWorkerRawSize ||
  workerLifecycle[0]?.dataReceivedEvents < 1 ||
  workerLifecycle[0]?.wireBodySizeKnown !== false ||
  workerLifecycle[0]?.headersSize !== -1 ||
  workerLifecycle[0]?.bodySize !== -1 ||
  workerLifecycle[0]?.compression !== null
) {
  failures.push('cumulative: regex Worker lacks one complete, decoded, non-duplicated Network lifecycle');
}
const ui = cumulativeReport.uiActionInventory;
const requiredUiFlags = [
  'largeDocumentClean100k',
  'largeDocumentCleanWithin500ms',
  'cleanSelected',
  'format',
  'minify',
  'replacementRuleAdded',
  'individualLiteralRuleApplied',
  'pathologicalRegexTimeoutVisible',
  'pathologicalRegexDocumentUnchanged',
  'applyAllReplacements',
  'replacementRuleRemoved',
  'commonMassUndo',
  'emojiDialogOpened',
  'emojiSearchFiltered',
  'emojiInserted',
  'htmlImported',
  'docxDroppedIntoTinyMce',
  'docxImported',
  'mammothRequestedByDocxImport',
  'htmlExportDownloaded',
  'htmlCopied',
  'textCopied',
  'sampleLoaded',
  'draftAutosaved',
  'newDocumentCreated',
];
if (
  !ui ||
  ui.cleanupRuleButtonsExpected !== 10 ||
  ui.cleanupRuleButtonsApplied !== 10 ||
  !requiredUiFlags.every((key) => ui[key] === true) ||
  typeof ui.largeDocumentCleanDurationMs !== 'number' ||
  ui.largeDocumentCleanDurationMs > 500
) {
  failures.push('cumulative: complete E3 UI action inventory or 100,000-character timing is missing');
}
for (const path of [...coldReport.requests, ...cumulativeReport.requests].map(pathname)) {
  if (isDiagnosticFixturePath(path)) {
    failures.push(`E3 production capture contains a diagnostic fixture request: ${path}`);
  }
}
if (Date.parse(cumulativeReport.capturedAt) < Date.parse(coldReport.capturedAt)) {
  failures.push('cumulative: capture predates the cold capture');
}

const sum = (items, key) => items.reduce((total, item) => total + item[key], 0);
const initialJs = coldRows.filter((row) => {
  const pathname = new URL(row.url).pathname;
  return pathname.endsWith('.js') && !pathname.startsWith('/tinymce/');
});

const coldTransfer = {
  gzip: sum(coldRows, 'gzip'),
  brotli: sum(coldRows, 'brotli'),
};
const cumulativeTransfer = {
  gzip: sum(cumulativeRows, 'gzip'),
  brotli: sum(cumulativeRows, 'brotli'),
};
const initialJsTransfer = {
  gzip: sum(initialJs, 'gzip'),
  brotli: sum(initialJs, 'brotli'),
};

const metrics = [
  {
    name: 'Cold editor-ready transfer (gzip)',
    actual: coldTransfer.gzip,
    budget: BYTE_BUDGETS.cold.gzip,
  },
  {
    name: 'Cold editor-ready transfer (brotli)',
    actual: coldTransfer.brotli,
    budget: BYTE_BUDGETS.cold.brotli,
  },
  {
    name: 'Cumulative E3 transfer (gzip)',
    actual: cumulativeTransfer.gzip,
    budget: BYTE_BUDGETS.cumulative.gzip,
  },
  {
    name: 'Cumulative E3 transfer (brotli)',
    actual: cumulativeTransfer.brotli,
    budget: BYTE_BUDGETS.cumulative.brotli,
  },
  {
    name: 'Cold-load HTTP requests',
    actual: coldReport.requests.length,
    budget: COLD_REQUEST_BUDGET,
  },
];

for (const metric of metrics) {
  metric.margin = metric.budget - metric.actual;
  metric.status = metric.margin >= 0 ? 'PASS' : 'FAIL';
  if (metric.margin < 0) failures.push(`${metric.name} exceeds budget by ${-metric.margin}`);
}

const tinyFiles = await Promise.all(TINYMCE_ASSETS.map(async (asset) => {
  const bytes = await readFile(resolve(distRoot, 'tinymce', asset));
  return { path: asset, ...compressedSizes(bytes) };
}));
const tinyStaticFootprint = {
  files: tinyFiles.length,
  raw: sum(tinyFiles, 'raw'),
  gzip: sum(tinyFiles, 'gzip'),
  brotli: sum(tinyFiles, 'brotli'),
};
const activeLightTinyFiles = tinyFiles.filter(
  ({ path }) => !path.includes('/oxide-dark/') && !path.includes('/content/dark/'),
);
const activeLightTinyStaticFootprint = {
  files: activeLightTinyFiles.length,
  raw: sum(activeLightTinyFiles, 'raw'),
  gzip: sum(activeLightTinyFiles, 'gzip'),
  brotli: sum(activeLightTinyFiles, 'brotli'),
};

const allUrls = [...coldReport.requests, ...cumulativeReport.requests].map(({ url }) => url);
const defaultIconRequests = allUrls.filter(
  (rawUrl) => new URL(rawUrl).pathname === '/tinymce/icons/default/icons.min.js',
);
const coldCustomIconRequests = coldReport.requests.filter(
  ({ url }) => new URL(url).pathname === '/tinymce/icons/phphtmledit/icons.min.js',
);
const cumulativeCustomIconRequests = cumulativeReport.requests.filter(
  ({ url }) => new URL(url).pathname === '/tinymce/icons/phphtmledit/icons.min.js',
);
const stockEmoticonRequests = allUrls.filter(
  (rawUrl) => new URL(rawUrl).pathname === `/tinymce/${STOCK_EMOTICONS_DATABASE_ASSET}`,
);
const coldCustomEmoticonRequests = coldReport.requests.filter(
  ({ url }) => new URL(url).pathname === `/tinymce/${CUSTOM_EMOTICONS_DATABASE_ASSET}`,
);
const cumulativeCustomEmoticonRequests = cumulativeReport.requests.filter(
  ({ url }) => new URL(url).pathname === `/tinymce/${CUSTOM_EMOTICONS_DATABASE_ASSET}`,
);
if (defaultIconRequests.length > 0) {
  failures.push('Stock TinyMCE default icon bundle was requested');
}
if (coldCustomIconRequests.length !== 1) {
  failures.push(`Expected exactly one cold custom-icon request, got ${coldCustomIconRequests.length}`);
}
if (cumulativeCustomIconRequests.length !== 1) {
  failures.push(`Expected exactly one cumulative custom-icon request, got ${cumulativeCustomIconRequests.length}`);
}
if (stockEmoticonRequests.length > 0) {
  failures.push('Stock TinyMCE emoji database was requested');
}
if (coldCustomEmoticonRequests.length !== 1) {
  failures.push(`Expected exactly one cold custom-emoji request, got ${coldCustomEmoticonRequests.length}`);
}
if (cumulativeCustomEmoticonRequests.length !== 1) {
  failures.push(`Expected exactly one cumulative custom-emoji request, got ${cumulativeCustomEmoticonRequests.length}`);
}
const tinyDomainRequests = allUrls.filter((rawUrl) => {
  const hostname = new URL(rawUrl).hostname.toLowerCase();
  return hostname === 'tiny.cloud' || hostname.endsWith('.tiny.cloud')
    || hostname === 'tinymce.com' || hostname.endsWith('.tinymce.com');
});
if (tinyDomainRequests.length > 0) failures.push('Tiny Cloud/domain requests were observed');

const output = {
  stage: 'E3',
  origin: expectedOrigin,
  manifestSha256,
  docxFixtureSha256,
  definitions: {
    cold: 'All production HTTP resources requested from navigation through editor-ready.',
    cumulative: 'A separate fresh production load containing every cold URL, first source focus, the complete E2 document-tools inventory, custom emoji search/insert, actual HTML and DOCX imports, HTML export, clipboard actions, product sample, draft autosave and new document; the only cumulative JavaScript additions are source-rich, safe replacement, Mammoth and the isolated regex Worker.',
    requestCount: 'Cold load through editor-ready only, including the HTML document.',
    initialJs: 'Supplementary, non-budget detail: cold-load JavaScript outside /tinymce; lazy source-editor tools are excluded.',
  },
  metrics,
  coldEditorReadyTransfer: {
    requests: coldReport.requests.length,
    ...coldTransfer,
  },
  cumulativeTransfer: {
    requests: cumulativeReport.requests.length,
    ...cumulativeTransfer,
  },
  supplementary: {
    initialJsWithoutTinyMCE: initialJsTransfer,
    largeDocumentCleanDurationMs: cumulativeReport.uiActionInventory?.largeDocumentCleanDurationMs ?? null,
  },
  activeLightTinyStaticFootprint,
  tinyStaticFootprint,
  tinyDomainRequests,
  scenarios: {
    cold: { capturedAt: coldReport.capturedAt, requests: coldRows },
    cumulative: { capturedAt: cumulativeReport.capturedAt, requests: cumulativeRows },
  },
  failures,
};

await writeFile(resolve(reportsRoot, 'size-e3-result.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output, null, 2));
if (failures.length > 0) process.exitCode = 1;
