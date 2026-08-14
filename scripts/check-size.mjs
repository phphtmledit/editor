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
const tinyCoreHref = '/tinymce/tinymce.min.js?v=8.8.2';
const tinyCorePath = '/tinymce/tinymce.min.js';
const tinyCoreUrl = new URL(tinyCoreHref, expectedOrigin).href;
const expectedBootMarkNames = Object.freeze([
  'phe:bootstrap:paint-handoff-complete',
  'phe:bootstrap:tinymce-script-inserted',
  'phe:bootstrap:tinymce-runtime-loaded',
  'phe:bootstrap:initialise-started',
  'phe:bootstrap:editor-ready',
]);
const expectedBootOrderingKeys = Object.freeze([
  'preloadFetchStartedBeforeDynamicInsertion',
  'skeletonPaintedBeforeDynamicInsertion',
  'contentfulPaintBeforeDynamicInsertion',
  'dynamicInsertionBeforeLoad',
  'runtimeAvailableAtLoad',
  'loadBeforeInitialise',
  'runtimeAvailableAtInitialise',
  'initialiseBeforeEditorReady',
  'performanceMarkSequenceExact',
  'editorReadyMarkReconcilesWithDom',
]);
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
  distIndexBytes,
  distAssetNames,
  distNames,
  docxFixtureBytes,
] = await Promise.all([
  readFile(resolve(reportsRoot, 'network-e4-cold.json'), 'utf8').then(JSON.parse),
  readFile(resolve(reportsRoot, 'network-e4-cumulative.json'), 'utf8').then(JSON.parse),
  readFile(resolve(distRoot, '.vite', 'manifest.json')),
  readFile(resolve(distRoot, 'index.html')),
  readdir(resolve(distRoot, 'assets')),
  readdir(distRoot, { recursive: true }),
  readFile(resolve(projectRoot, 'tests', 'fixtures', 'mammoth-fixture.docx')),
]);
const manifestSha256 = createHash('sha256').update(manifestBytes).digest('hex');
const distIndexSha256 = createHash('sha256').update(distIndexBytes).digest('hex');
const initialTagInventory = (html) => [...html.matchAll(/<(link|script)\b[^>]*>/gi)].map((match) => {
  const attributes = {};
  for (const attribute of match[0].matchAll(/\s([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    attributes[attribute[1].toLowerCase()] = attribute[2] ?? attribute[3] ?? attribute[4] ?? '';
  }
  return { tagName: match[1].toLowerCase(), attributes };
});
const distIndexTags = initialTagInventory(distIndexBytes.toString('utf8'));
const distTinyPreloads = distIndexTags.filter(({ tagName, attributes }) =>
  tagName === 'link' &&
  (attributes.rel ?? '').toLowerCase().split(/\s+/).includes('preload') &&
  (attributes.as ?? '').toLowerCase() === 'script' &&
  typeof attributes.href === 'string' &&
  new URL(attributes.href, expectedOrigin).href === tinyCoreUrl
);
const distTinyScripts = distIndexTags.filter(({ tagName, attributes }) =>
  tagName === 'script' &&
  typeof attributes.src === 'string' &&
  new URL(attributes.src, expectedOrigin).pathname === tinyCorePath
);
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
const darkTinyDistNames = normalizedDistNames.filter((name) =>
  name.includes('tinymce/skins/ui/oxide-dark/') ||
  name.includes('tinymce/skins/content/dark/')
);

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
  failures.push('product entry must dynamically import only source-rich, safe replacement and Mammoth in E4');
}
if (JSON.stringify(dynamicEntryKeys) !== JSON.stringify(expectedDynamicEntryKeys)) {
  failures.push(`dist manifest must have exactly the three E4 dynamic entries, got ${dynamicEntryKeys.join(', ')}`);
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
if (darkTinyDistNames.length > 0) {
  failures.push(`production dist contains excluded dark TinyMCE assets: ${darkTinyDistNames.join(', ')}`);
}
if (distTinyPreloads.length !== 1 || distTinyScripts.length !== 0) {
  failures.push(`built HTML must contain exactly one ${tinyCoreUrl} preload and zero executable Tiny core scripts`);
}
for (const [key, entry] of Object.entries(manifest)) {
  const manifestText = `${key} ${entry?.src ?? ''} ${entry?.file ?? ''}`;
  if (/(?:\.docx|fixture)/i.test(manifestText)) {
    failures.push(`production manifest contains a diagnostic fixture: ${manifestText}`);
  }
}

const bootOrderingOk = (proof) => proof?.tinyCoreUrl === tinyCoreUrl &&
  proof.dynamicTinyScriptCount === 1 &&
  proof.tinyScriptLoadEventCount === 1 &&
  proof.tinyInitCallCount === 1 &&
  proof.tinyResourceEntryCount === 1 &&
  proof.dynamicTinyScripts?.[0]?.src === tinyCoreUrl &&
  proof.tinyScriptLoadEvents?.[0]?.src === tinyCoreUrl &&
  proof.resourceEntries?.[0]?.name === tinyCoreUrl &&
  proof.resourceEntries?.[0]?.initiatorType === 'link' &&
  JSON.stringify(proof.expectedBootMarkNames) === JSON.stringify(expectedBootMarkNames) &&
  JSON.stringify(proof.performanceMarks?.map(({ name }) => name)) ===
    JSON.stringify(expectedBootMarkNames) &&
  proof.performanceMarks.every((mark, index) => index === 0 ||
    proof.performanceMarks[index - 1].entryOrder < mark.entryOrder) &&
  proof.performanceMarks.every((mark, index) => index === 0 ||
    proof.performanceMarks[index - 1].startTime <= mark.startTime) &&
  proof.performanceMarkSequenceExact === true &&
  proof.editorReadyMarkReconcilesWithDom === true &&
  typeof proof.editorReadyMarkDomDeltaMs === 'number' &&
  proof.editorReadyMarkDomDeltaMs <= 100 &&
  proof.tinyRuntimeAvailableAtLoad === true &&
  proof.tinyInitWrapped === true &&
  proof.tinyInitWrapError === null &&
  JSON.stringify(Object.keys(proof.ordering ?? {}).sort()) ===
    JSON.stringify([...expectedBootOrderingKeys].sort()) &&
  Object.values(proof.ordering).every((value) => value === true);

const loadingPerformanceOk = (proof, metrics) =>
  typeof proof?.visibleFrom === 'number' &&
  typeof proof?.firstPaintStartTime === 'number' &&
  typeof proof?.firstContentfulPaintStartTime === 'number' &&
  typeof proof?.firstHiddenAt === 'number' &&
  typeof proof?.editorReadyAt === 'number' &&
  proof.visibleFrom <= proof.firstPaintStartTime &&
  proof.firstPaintStartTime < proof.firstHiddenAt &&
  proof.visibleFrom <= proof.firstContentfulPaintStartTime &&
  proof.firstContentfulPaintStartTime < proof.firstHiddenAt &&
  proof.firstHiddenAt <= proof.editorReadyAt &&
  typeof metrics?.navigationToFirstSkeletonPaintMs === 'number' &&
  typeof metrics?.skeletonPaintToEditorReadyMs === 'number' &&
  typeof metrics?.navigationToEditorReadyMs === 'number' &&
  typeof proof?.editorReadyMarkStartTime === 'number' &&
  typeof proof?.editorReadyMarkDomDeltaMs === 'number' &&
  proof.editorReadyMarkDomDeltaMs <= 100 &&
  Math.abs(metrics.navigationToFirstSkeletonPaintMs - proof.firstPaintStartTime) <= 0.001 &&
  Math.abs(metrics.skeletonPaintToEditorReadyMs -
    (proof.editorReadyMarkStartTime - proof.firstPaintStartTime)) <= 0.001 &&
  Math.abs(metrics.navigationToEditorReadyMs - proof.editorReadyMarkStartTime) <= 0.001 &&
  Math.abs(metrics.navigationToFirstSkeletonPaintMs +
    metrics.skeletonPaintToEditorReadyMs - metrics.navigationToEditorReadyMs) <= 0.001;

const assertReportShape = (name, report, scenario) => {
  if (!report || typeof report !== 'object') throw new TypeError(`${name}: report must be an object`);
  if (typeof report.pageUrl !== 'string') throw new TypeError(`${name}: pageUrl must be a string`);
  if (!Array.isArray(report.requests)) throw new TypeError(`${name}: requests must be an array`);
  if (report.requests.length === 0) failures.push(`${name}: network capture is empty`);
  if (typeof report.capturedAt !== 'string' || Number.isNaN(Date.parse(report.capturedAt))) {
    failures.push(`${name}: capturedAt is missing or invalid`);
  }
  if (report.stage !== 'E4') failures.push(`${name}: stage must be E4`);
  if (report.scenario !== scenario) failures.push(`${name}: scenario must be ${scenario}`);
  if (report.manifestSha256 !== manifestSha256) {
    failures.push(`${name}: capture manifest hash does not match current dist`);
  }
  if (report.docxFixtureSha256 !== docxFixtureSha256) {
    failures.push(`${name}: capture DOCX fixture hash does not match tests/fixtures/mammoth-fixture.docx`);
  }
  const initialHtml = report.initialHtmlContract;
  if (
    initialHtml?.status !== 200 ||
    initialHtml?.sha256 !== distIndexSha256 ||
    initialHtml?.distIndexSha256 !== distIndexSha256 ||
    initialHtml?.matchesCurrentDist !== true ||
    initialHtml?.tinyCoreUrl !== tinyCoreUrl ||
    initialHtml?.exactTinyPreloadCount !== 1 ||
    initialHtml?.initialExecutableTinyScriptCount !== 0 ||
    !Array.isArray(initialHtml?.tinyPreloads) ||
    initialHtml.tinyPreloads.length !== 1 ||
    new URL(initialHtml.tinyPreloads[0]?.attributes?.href ?? '/', expectedOrigin).href !== tinyCoreUrl ||
    !Array.isArray(initialHtml?.tinyScripts) ||
    initialHtml.tinyScripts.length !== 0
  ) {
    failures.push(`${name}: served HTML must match current dist, preload the exact Tiny core URL once and contain zero executable Tiny core scripts`);
  }
  if (!bootOrderingOk(report.bootOrdering)) {
    failures.push(`${name}: Tiny preload/resource/runtime/initialise ordering proof is incomplete`);
  }
  if (JSON.stringify(report.bootOrdering) !== JSON.stringify(report.uiActionInventory?.bootOrdering)) {
    failures.push(`${name}: top-level and UI-inventory Tiny ordering proofs differ`);
  }
  const paintProof = report.uiActionInventory?.loadingPaintProof;
  if (!loadingPerformanceOk(paintProof, report.loadingPerformanceMetrics)) {
    failures.push(`${name}: the three navigation/skeleton/editor-ready metrics are missing or arithmetically inconsistent`);
  }
  if (JSON.stringify(report.loadingPerformanceMetrics) !==
      JSON.stringify(report.uiActionInventory?.loadingPerformanceMetrics)) {
    failures.push(`${name}: top-level and UI-inventory loading metrics differ`);
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
const countUrl = (report, expectedUrl) =>
  report.requests.filter(({ url }) => url === expectedUrl).length;

for (const requiredPath of REQUIRED_COLD_PATHS) {
  if (!coldPaths.has(requiredPath)) failures.push(`cold: required request is missing: ${requiredPath}`);
}
if (appPath && countPath(coldReport, appPath) !== 1) {
  failures.push(`cold: expected the manifest application entry exactly once: ${appPath}`);
}
if (countPath(coldReport, tinyCorePath) !== 1 || countUrl(coldReport, tinyCoreUrl) !== 1) {
  failures.push(`cold: expected the exact Tiny core query URL once: ${tinyCoreUrl}`);
}
if (countPath(cumulativeReport, tinyCorePath) !== 1 || countUrl(cumulativeReport, tinyCoreUrl) !== 1) {
  failures.push(`cumulative: expected the exact Tiny core query URL once: ${tinyCoreUrl}`);
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
  'loadingSkeletonObserved',
  'editorReadyAfterSkeleton',
  'docxBusyStateVisible',
  'docxBusyStateRestored',
];
if (
  !ui ||
  ui.cleanupRuleButtonsExpected !== 10 ||
  ui.cleanupRuleButtonsApplied !== 10 ||
  !requiredUiFlags.every((key) => ui[key] === true) ||
  typeof ui.largeDocumentCleanDurationMs !== 'number' ||
  ui.largeDocumentCleanDurationMs > 500
) {
  failures.push('cumulative: complete E3 action inventory, E4 lifecycle proof or 100,000-character timing is missing');
}
for (const path of [...coldReport.requests, ...cumulativeReport.requests].map(pathname)) {
  if (isDiagnosticFixturePath(path)) {
    failures.push(`E4 production capture contains a diagnostic fixture request: ${path}`);
  }
  if (
    path.includes('/tinymce/skins/ui/oxide-dark/') ||
    path.includes('/tinymce/skins/content/dark/')
  ) {
    failures.push(`E4 production capture contains an excluded dark TinyMCE request: ${path}`);
  }
}
if (Date.parse(cumulativeReport.capturedAt) < Date.parse(coldReport.capturedAt)) {
  failures.push('cumulative: capture predates the cold capture');
}

const e4Ui = cumulativeReport.e4UiValidation;
const expectedThemeQueries = ['', '?theme=light', '?theme=dark', '?theme=auto', '?theme=unexpected'];
const expectedViewports = [
  { width: 1440, expectedMode: 'desktop' },
  { width: 1024, expectedMode: 'desktop' },
  { width: 900, expectedMode: 'desktop' },
  { width: 899, expectedMode: 'mobile' },
  { width: 768, expectedMode: 'mobile' },
  { width: 390, expectedMode: 'mobile' },
  { width: 320, expectedMode: 'mobile' },
];
const themeAuditOk =
  Array.isArray(e4Ui?.themeQueries) &&
  JSON.stringify(e4Ui.themeQueries.map(({ query }) => query)) === JSON.stringify(expectedThemeQueries) &&
  e4Ui.themeQueries.every((state) =>
    state.passed === true &&
    state.dataTheme === 'light' &&
    state.colorScheme === 'light' &&
    state.editorColorScheme === 'light' &&
    state.tinySkin === 'oxide' &&
    Array.isArray(state.darkReferences) &&
    state.darkReferences.length === 0 &&
    state.aboutVisible === false
  );
if (!themeAuditOk) {
  failures.push('E4 UI audit must prove that every supported/unsupported ?theme= query resolves to the light app and oxide TinyMCE skin without dark assets or About');
}

const viewportAuditOk =
  Array.isArray(e4Ui?.viewports) &&
  e4Ui.viewports.length === expectedViewports.length &&
  e4Ui.viewports.every((state, index) => {
    const expected = expectedViewports[index];
    const common = state.width === expected.width &&
      state.expectedMode === expected.expectedMode &&
      state.mode === expected.expectedMode &&
      state.workspaceNonzero === true &&
      state.visualNonzero === true &&
      state.sourceNonzero === true &&
      state.noHorizontalOverflow === true &&
      Number.parseFloat(state.viewportHeightCss) > 0 &&
      Number.isFinite(Number.parseFloat(state.viewportOffsetCss)) &&
      state.passed === true;
    if (!common) return false;
    return expected.expectedMode === 'desktop'
      ? state.tabsHidden === true && state.splitterHidden === false && state.desktopSplit === true
      : state.tabsHidden === false && state.splitterHidden === true && state.mobileTabSwitchWorked === true;
  });
if (!viewportAuditOk) {
  failures.push('E4 UI audit must prove desktop split at 1440/1024/900 and mobile tabs at 899/768/390/320 with nonzero editors and no horizontal overflow');
}

const coarseAuditOk =
  e4Ui?.coarsePointer?.emulated === true &&
  e4Ui.coarsePointer.hoverNone === true &&
  e4Ui.coarsePointer.emulationError === null &&
  Array.isArray(e4Ui.coarsePointer.controls) &&
  e4Ui.coarsePointer.controls.length > 0 &&
  e4Ui.coarsePointer.controls.every(({ atLeast44, width, height }) =>
    atLeast44 === true && width >= 43.5 && height >= 43.5) &&
  Array.isArray(e4Ui.coarsePointer.failures) &&
  e4Ui.coarsePointer.failures.length === 0 &&
  e4Ui.coarsePointer.allAtLeast44 === true;
if (!coarseAuditOk) {
  failures.push('E4 UI audit must prove every visible app/TinyMCE button is at least 44x44 under emulated coarse pointer input');
}

const contrastAuditOk =
  e4Ui?.contrast?.allAtLeast4_5 === true &&
  Array.isArray(e4Ui.contrast.pairs) &&
  e4Ui.contrast.pairs.length === 5 &&
  e4Ui.contrast.pairs.every(({ ratio }) => typeof ratio === 'number' && ratio >= 4.5);
if (!contrastAuditOk) failures.push('E4 UI audit must prove all five computed text/background pairs are at least 4.5:1');

if (e4Ui?.focus?.productButton !== true || e4Ui.focus.solidAccent !== true) {
  failures.push('E4 UI audit must prove a keyboard focus-visible outline is solid, at least 3px and uses --phe-accent');
}
if (
  e4Ui?.visualViewport?.available !== true ||
  e4Ui.visualViewport.resizeUpdated !== true
) {
  failures.push('E4 UI audit must prove visualViewport resize updates --phe-viewport-height and --phe-viewport-offset-top');
}
if (
  !e4Ui?.loadingLifecycle ||
  !Object.values(e4Ui.loadingLifecycle).every((value) => value === true)
) {
  failures.push('E4 UI audit must prove the visible busy skeleton transitions to two ready editors in both network scenarios');
}
const paintProofOk =
  e4Ui?.loadingPaintProof &&
  ['cold', 'cumulative'].every((scenario) => {
    const proof = e4Ui.loadingPaintProof[scenario];
    const metrics = e4Ui.loadingPerformanceMetrics?.[scenario];
    return loadingPerformanceOk(proof, metrics) &&
      Math.abs(proof.visibleDurationMs - (proof.firstHiddenAt - proof.visibleFrom)) <= 0.001 &&
      Math.abs(proof.firstPaintOffsetFromVisibleMs -
        (proof.firstPaintStartTime - proof.visibleFrom)) <= 0.001 &&
      Math.abs(proof.hiddenAfterFirstPaintMs -
        (proof.firstHiddenAt - proof.firstPaintStartTime)) <= 0.001 &&
      (proof.firstNonzeroGeometry?.geometry?.width ?? 0) > 0 &&
      (proof.firstNonzeroGeometry?.geometry?.height ?? 0) > 0 &&
      proof.firstNonzeroGeometry?.appBusy === 'true' &&
      proof.firstNonzeroGeometry?.skeletonHidden === false &&
      (proof.editorReadyState?.editors?.visual?.width ?? 0) > 0 &&
      (proof.editorReadyState?.editors?.visual?.height ?? 0) > 0 &&
      (proof.editorReadyState?.editors?.source?.width ?? 0) > 0 &&
      (proof.editorReadyState?.editors?.source?.height ?? 0) > 0 &&
      (proof.hiddenState?.skeletonHidden === true || proof.hiddenState?.display === 'none') &&
      Array.isArray(proof.paintEntries) &&
      proof.paintEntries.some(({ name }) => name === 'first-paint') &&
      proof.paintEntries.some(({ name }) => name === 'first-contentful-paint') &&
      proof.paintObserverError === null;
  });
if (!paintProofOk) {
  failures.push('E4 UI audit must prove the skeleton spans FP and FCP, reaches two ready editors, and records all three exact navigation/skeleton/editor-ready metrics');
}
const bootOrderingAuditOk = ['cold', 'cumulative'].every((scenario) =>
  bootOrderingOk(e4Ui?.bootOrdering?.[scenario])
);
if (!bootOrderingAuditOk) {
  failures.push('E4 canonical audit must prove one preloaded Tiny resource, one post-paint runtime script and runtime availability before initialise');
}
if (
  !e4Ui?.docxBusyLifecycle ||
  !Object.values(e4Ui.docxBusyLifecycle).every((value) => value === true)
) {
  failures.push('E4 UI audit must prove the DOCX busy/disabled state is painted before parsing and restored afterward');
}
if (e4Ui?.aboutAbsent !== true) failures.push('E4 UI audit must prove About is absent before E5');
if (!Array.isArray(e4Ui?.consoleProblems) || e4Ui.consoleProblems.length !== 0) {
  failures.push('E4 isolated UI audit contains console errors or warnings');
}
if (e4Ui?.allPassed !== true) failures.push('E4 isolated UI audit did not pass every strict assertion');

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
    name: 'Cumulative E4 transfer (gzip)',
    actual: cumulativeTransfer.gzip,
    budget: BYTE_BUDGETS.cumulative.gzip,
  },
  {
    name: 'Cumulative E4 transfer (brotli)',
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
  stage: 'E4',
  origin: expectedOrigin,
  manifestSha256,
  docxFixtureSha256,
  definitions: {
    cold: 'All production HTTP resources requested from navigation through editor-ready.',
    cumulative: 'A separate fresh production load containing every cold URL, first source focus, the complete E2 document-tools inventory, custom emoji search/insert, actual HTML and DOCX imports, HTML export, clipboard actions, product sample, draft autosave and new document; the only cumulative JavaScript additions are source-rich, safe replacement, Mammoth and the isolated regex Worker. E4 responsive/theme/accessibility checks run in a separate browser without Network enabled and cannot contaminate this byte inventory.',
    requestCount: 'Cold load through editor-ready only, including the HTML document.',
    initialJs: 'Supplementary, non-budget detail: cold-load JavaScript outside /tinymce; lazy source-editor tools are excluded.',
    loadingPerformance: 'Diagnostic navigation timeline in milliseconds: navigation start to the first skeleton paint, first skeleton paint to the fixed phe:bootstrap:editor-ready product mark, and their exact total. The product mark is reconciled to the sampled nonzero DOM-ready state within 100 ms. These timing values are not byte-budget inputs.',
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
    loadingPerformanceMetrics: e4Ui?.loadingPerformanceMetrics ?? null,
    tinyBootOrdering: e4Ui?.bootOrdering ?? null,
    e4UiValidation: e4Ui,
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

await writeFile(resolve(reportsRoot, 'size-e4-result.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output, null, 2));
if (failures.length > 0) process.exitCode = 1;
