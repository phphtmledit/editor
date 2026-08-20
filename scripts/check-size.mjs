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
const expectedSourceUrl = 'https://github.com/phphtmledit/editor';
const expectedNoticesHref = '/licenses.txt';
const expectedNoticesUrl = new URL(expectedNoticesHref, expectedOrigin).href;
const expectedAccent = 'rgb(11, 107, 203)';
const expectedAccentSoft = 'rgb(230, 241, 251)';
const expectedText = 'rgb(23, 32, 51)';
const expectedTinyLinkSaveButtonSelector =
  'button.tox-button:not(.tox-button--secondary):not(.tox-button--naked)';
const expectedTinyLinkSaveButtonLabel = 'Save';
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
const expectedE5AssertionNames = Object.freeze([
  'coldApplicationRequests',
  'coldRequestBudget',
  'cumulativeApplicationRequests',
  'cumulativeContainsCold',
  'onlyLocal',
  'onlyGet',
  'noCacheOrServiceWorker',
  'legalTopLevelNavigationsOutsideEditorPayload',
  'initialHtmlUsesTinyPreloadOnly',
  'tinyCoreExactlyOnce',
  'preloadRuntimeOrdering',
  'loadingPerformanceMetricsExact',
  'defaultIconsAbsent',
  'customIconsOnce',
  'customEmoticonsOnce',
  'stockEmoticonsAbsent',
  'darkTinyAssetsAbsent',
  'sourceRichLazyOnlyInCumulative',
  'safeReplaceLazyOnlyInCumulative',
  'mammothLazyOnlyInCumulative',
  'mammothRequestedByActualDocxImport',
  'regexWorkerOnlyInCumulative',
  'workerTargetOnlyInCumulative',
  'workerSessionSetupClean',
  'workerLifecycleCompleteWithoutDuplicate',
  'workerTargetSessionProofExact',
  'regexLifecycleRequestedSafeAndWorker',
  'onlyExpectedCumulativeJavaScript',
  'eagerHighlightBeforeSourceFocus',
  'fullE3UiActionInventory',
  'e5LifecycleInventory',
  'aboutVisibleExactlyOncePerTheme',
  'aboutItemsExactlySourceAndNotices',
  'aboutActiveItemUsesExactAccentSoft',
  'aboutSourceLinkExact',
  'aboutNoticesLinkExact',
  'aboutTemporaryAnchorsRemoved',
  'aboutSourceNativePopupExactlyOne',
  'aboutNoticesNativePopupExactlyOne',
  'noticesHttp200TextPlainUtf8NoAttachment',
  'exactE5Palette',
  'tinyLinkDialogUsesExactAccent',
  'contrastAtLeast4_5',
  'nativeControlAccent',
  'coarseTouchTargetsAtLeast44',
  'fullE5UiAudit',
  'fixturesAbsent',
  'consoleClean',
  'noApplicationFailures',
  'decodedContentSizes',
  'exactHarTimingSums',
  'noSensitiveHeadersOrBodies',
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
  coldReportBytes,
  cumulativeReportBytes,
  coldHarBytes,
  cumulativeHarBytes,
  harResultBytes,
  manifestBytes,
  distIndexBytes,
  distAssetNames,
  distNames,
  docxFixtureBytes,
] = await Promise.all([
  readFile(resolve(reportsRoot, 'network-e5-cold.json')),
  readFile(resolve(reportsRoot, 'network-e5-cumulative.json')),
  readFile(resolve(reportsRoot, 'network-e5-cold.har')),
  readFile(resolve(reportsRoot, 'network-e5-cumulative.har')),
  readFile(resolve(reportsRoot, 'network-e5-har-result.json')),
  readFile(resolve(distRoot, '.vite', 'manifest.json')),
  readFile(resolve(distRoot, 'index.html')),
  readdir(resolve(distRoot, 'assets')),
  readdir(distRoot, { recursive: true }),
  readFile(resolve(projectRoot, 'tests', 'fixtures', 'mammoth-fixture.docx')),
]);
const coldReport = JSON.parse(coldReportBytes.toString('utf8'));
const cumulativeReport = JSON.parse(cumulativeReportBytes.toString('utf8'));
const coldHar = JSON.parse(coldHarBytes.toString('utf8'));
const cumulativeHar = JSON.parse(cumulativeHarBytes.toString('utf8'));
const harResultReport = JSON.parse(harResultBytes.toString('utf8'));
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
const reportArtifactBindings = {
  coldHarSha256: createHash('sha256').update(coldHarBytes).digest('hex'),
  coldReportSha256: createHash('sha256').update(coldReportBytes).digest('hex'),
  cumulativeHarSha256: createHash('sha256').update(cumulativeHarBytes).digest('hex'),
  cumulativeReportSha256: createHash('sha256').update(cumulativeReportBytes).digest('hex'),
};
if (
  harResultReport?.stage !== 'E5' ||
  typeof harResultReport.capturedAt !== 'string' ||
  Number.isNaN(Date.parse(harResultReport.capturedAt)) ||
  harResultReport.manifestSha256 !== manifestSha256 ||
  harResultReport.distIndexSha256 !== distIndexSha256 ||
  harResultReport.docxFixtureSha256 !== docxFixtureSha256 ||
  harResultReport.expectedSourceUrl !== expectedSourceUrl ||
  harResultReport.expectedNoticesUrl !== expectedNoticesUrl ||
  harResultReport.journalTruncated !== false ||
  JSON.stringify(harResultReport.artifactBindings) !== JSON.stringify(reportArtifactBindings)
) {
  failures.push('network-e5-har-result.json is not byte-bound to the four fresh E5 HAR/JSON artifacts and current dist/fixture hashes');
}
const expectedLegalNavigationBudgetScope = {
  includedInEditorColdOrCumulativePayload: false,
  noticesRequestedByEditorDocumentGraph: false,
  sourceRequestedByEditorDocumentGraph: false,
  rationale: 'Both About links create independent top-level browsing contexts. Neither destination is a resource consumed by the editor document graph, so the notices delivery check and native-tab proofs stay separate from editor cold/cumulative payload accounting.',
};
if (
  JSON.stringify(harResultReport?.legalNavigationBudgetScope) !==
    JSON.stringify(expectedLegalNavigationBudgetScope)
) {
  failures.push('E5 result must explicitly keep independent About-tab destinations outside editor document-graph byte accounting');
}
const harResultAssertionNames = Object.keys(harResultReport?.assertions ?? {}).sort();
if (
  JSON.stringify(harResultAssertionNames) !== JSON.stringify([...expectedE5AssertionNames].sort()) ||
  expectedE5AssertionNames.some((name) => harResultReport.assertions?.[name] !== true)
) {
  failures.push('network-e5-har-result.json must contain the exact named E5 assertion set with every assertion true');
}
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
  failures.push('product entry must dynamically import only source-rich, safe replacement and Mammoth in E5');
}
if (JSON.stringify(dynamicEntryKeys) !== JSON.stringify(expectedDynamicEntryKeys)) {
  failures.push(`dist manifest must have exactly the three E5 dynamic entries, got ${dynamicEntryKeys.join(', ')}`);
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
  if (report.stage !== 'E5') failures.push(`${name}: stage must be E5`);
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
if (
  coldUrls.has(expectedNoticesUrl) ||
  cumulativeUrls.has(expectedNoticesUrl) ||
  coldUrls.has(expectedSourceUrl) ||
  cumulativeUrls.has(expectedSourceUrl)
) {
  failures.push('About destinations must remain outside the editor cold/cumulative document-graph inventories');
}
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
const workerTarget = cumulativeReport.attachedWorkerTargets?.[0];
const expectedWorkerUrl = regexWorkerPath ? new URL(regexWorkerPath, expectedOrigin).href : null;
const expectedWorkerSessions = ['page', workerTarget?.sessionId].filter(Boolean).sort();
const observedWorkerSessions = [...(workerLifecycle?.[0]?.sessions ?? [])].sort();
const coldWorkerHarEntries = (coldHar?.log?.entries ?? []).filter((entry) =>
  regexWorkerPath && new URL(entry.request.url).pathname === regexWorkerPath
);
const cumulativeWorkerHarEntries = (cumulativeHar?.log?.entries ?? []).filter((entry) =>
  regexWorkerPath && new URL(entry.request.url).pathname === regexWorkerPath
);
const workerHarEntry = cumulativeWorkerHarEntries[0];
if (
  !Array.isArray(coldReport.attachedWorkerTargets) ||
  coldReport.attachedWorkerTargets.length !== 0 ||
  !Array.isArray(coldReport.workerSessionSetupErrors) ||
  coldReport.workerSessionSetupErrors.length !== 0 ||
  !Array.isArray(coldReport.workerNetworkLifecycle) ||
  coldReport.workerNetworkLifecycle.length !== 0 ||
  !Array.isArray(cumulativeReport.attachedWorkerTargets) ||
  cumulativeReport.attachedWorkerTargets.length !== 1 ||
  !Array.isArray(cumulativeReport.workerSessionSetupErrors) ||
  cumulativeReport.workerSessionSetupErrors.length !== 0 ||
  !Array.isArray(workerLifecycle) ||
  workerLifecycle.length !== 1 ||
  workerTarget?.type !== 'worker' ||
  workerTarget?.url !== expectedWorkerUrl ||
  !regexWorkerPath ||
  new URL(workerTarget.url).pathname !== regexWorkerPath ||
  workerLifecycle[0]?.url !== expectedWorkerUrl ||
  workerLifecycle[0]?.requestWillBeSentEvents !== 1 ||
  expectedWorkerSessions.length !== 2 ||
  JSON.stringify(observedWorkerSessions) !== JSON.stringify(expectedWorkerSessions) ||
  coldWorkerHarEntries.length !== 0 ||
  cumulativeWorkerHarEntries.length !== 1 ||
  workerHarEntry?.request?.url !== expectedWorkerUrl ||
  workerHarEntry?._requestWillBeSentEvents !== 1 ||
  JSON.stringify([...(workerHarEntry?._sessionIds ?? [])].sort()) !==
    JSON.stringify(expectedWorkerSessions) ||
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
  failures.push('cumulative: regex Worker must have one exact attached target/session pair and one complete, decoded, non-duplicated Network lifecycle');
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
  failures.push('cumulative: complete E3 action inventory, E5 lifecycle proof or 100,000-character timing is missing');
}
for (const path of [...coldReport.requests, ...cumulativeReport.requests].map(pathname)) {
  if (isDiagnosticFixturePath(path)) {
    failures.push(`E5 production capture contains a diagnostic fixture request: ${path}`);
  }
  if (
    path.includes('/tinymce/skins/ui/oxide-dark/') ||
    path.includes('/tinymce/skins/content/dark/')
  ) {
    failures.push(`E5 production capture contains an excluded dark TinyMCE request: ${path}`);
  }
}
if (Date.parse(cumulativeReport.capturedAt) < Date.parse(coldReport.capturedAt)) {
  failures.push('cumulative: capture predates the cold capture');
}
if (Date.parse(harResultReport.capturedAt) < Date.parse(cumulativeReport.capturedAt)) {
  failures.push('network-e5-har-result.json predates the cumulative capture');
}

const e5Ui = cumulativeReport.e5UiValidation;
if (
  JSON.stringify(harResultReport?.e5UiValidation) !== JSON.stringify(e5Ui) ||
  JSON.stringify(harResultReport?.initialHtmlContract) !== JSON.stringify(coldReport.initialHtmlContract) ||
  JSON.stringify(coldReport.initialHtmlContract) !== JSON.stringify(cumulativeReport.initialHtmlContract) ||
  JSON.stringify(harResultReport?.noticesHttpContract) !==
    JSON.stringify(e5Ui?.aboutMenu?.noticesHttp) ||
  harResultReport?.cold?.scenario !== 'cold' ||
  harResultReport?.cumulative?.scenario !== 'cumulative' ||
  coldHar?.log?.pages?.[0]?._scenario !== 'cold' ||
  cumulativeHar?.log?.pages?.[0]?._scenario !== 'cumulative' ||
  harResultReport?.cold?.entries !== coldHar?.log?.entries?.length ||
  harResultReport?.cumulative?.entries !== cumulativeHar?.log?.entries?.length ||
  harResultReport?.cold?.applicationRequests !== coldReport.requests.length ||
  harResultReport?.cumulative?.applicationRequests !== cumulativeReport.requests.length ||
  JSON.stringify(cumulativeHar?.log?.pages?.[0]?._e5UiValidation) !== JSON.stringify(e5Ui)
) {
  failures.push('network-e5-har-result.json summary is not structurally bound to the fresh cold/cumulative E5 reports and UI/notices evidence');
}
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
  Array.isArray(e5Ui?.themeQueries) &&
  JSON.stringify(e5Ui.themeQueries.map(({ query }) => query)) === JSON.stringify(expectedThemeQueries) &&
  e5Ui.themeQueries.every((state) =>
    state.passed === true &&
    state.dataTheme === 'light' &&
    state.colorScheme === 'light' &&
    state.editorColorScheme === 'light' &&
    state.tinySkin === 'oxide' &&
    Array.isArray(state.darkReferences) &&
    state.darkReferences.length === 0 &&
    state.aboutVisible === true &&
    state.aboutCount === 1 &&
    state.accent === expectedAccent &&
    state.accentSoft === expectedAccentSoft &&
    state.palettePassed === true &&
    Array.isArray(state.nativeControls) &&
    state.nativeControls.length > 0 &&
    state.nativeControls.every(({ accentColor }) => accentColor === expectedAccent) &&
    Array.isArray(state.tinyAccentValues) &&
    state.tinyAccentValues.length === 4 &&
    state.tinyAccentValues.every(({ value, resolvedColor }) =>
      typeof value === 'string' && value.length > 0 && resolvedColor === expectedAccent)
  );
if (!themeAuditOk) {
  failures.push('E5 UI audit must prove every ?theme= query resolves to the exact light palette, native/Tiny accents and one visible About menu without dark assets');
}

const expectedAboutItems = ['Source code', 'Third-party notices'];
const expectedAboutActivations = [
  {
    href: expectedSourceUrl,
    absoluteHref: expectedSourceUrl,
    target: '_blank',
    rel: 'noopener noreferrer',
    connectedAtActivation: true,
    nativeClickReturned: true,
  },
  {
    href: expectedNoticesHref,
    absoluteHref: expectedNoticesUrl,
    target: '_blank',
    rel: 'noopener noreferrer',
    connectedAtActivation: true,
    nativeClickReturned: true,
  },
];
const sourcePopup = e5Ui?.aboutMenu?.popupTargets?.source;
const noticesPopup = e5Ui?.aboutMenu?.popupTargets?.notices;
const sourceFinalUrlAllowed = (() => {
  if (typeof sourcePopup?.finalUrl !== 'string') return false;
  if (sourcePopup.finalUrl === expectedSourceUrl) return true;
  if (
    sourcePopup.redirect?.from !== expectedSourceUrl ||
    sourcePopup.redirect?.to !== sourcePopup.finalUrl
  ) return false;
  try {
    const finalUrl = new URL(sourcePopup.finalUrl);
    const expectedFinalUrl = new URL(expectedSourceUrl);
    return finalUrl.origin === expectedFinalUrl.origin &&
      finalUrl.pathname.replace(/\/+$/, '') === expectedFinalUrl.pathname.replace(/\/+$/, '') &&
      finalUrl.search === '' &&
      finalUrl.hash === '';
  } catch {
    return false;
  }
})();
const aboutMenuAuditOk =
  e5Ui?.aboutMenu?.passed === true &&
  e5Ui.aboutMenu.visible === true &&
  e5Ui.aboutMenu.itemCount === 2 &&
  Array.isArray(e5Ui.aboutMenu.items) &&
  JSON.stringify(e5Ui.aboutMenu.items.map(({ text }) => text)) ===
    JSON.stringify(expectedAboutItems) &&
  e5Ui.aboutMenu.items.every(({ role }) => role === 'menuitem') &&
  e5Ui.aboutMenu.activeStyle?.active === true &&
  e5Ui.aboutMenu.activeStyle?.exactSoftWithText === true &&
  e5Ui.aboutMenu.activeStyle?.color === expectedText &&
  e5Ui.aboutMenu.activeStyle?.backgroundColor === expectedAccentSoft &&
  e5Ui.aboutMenu.sourceUrl === expectedSourceUrl &&
  e5Ui.aboutMenu.noticesUrl === expectedNoticesUrl &&
  Array.isArray(e5Ui.aboutMenu.activations) &&
  JSON.stringify(e5Ui.aboutMenu.activations) === JSON.stringify(expectedAboutActivations) &&
  sourcePopup?.createdPageTargetCount === 1 &&
  typeof sourcePopup?.createdPageTargetId === 'string' &&
  sourcePopup?.targetType === 'page' &&
  sourcePopup?.requestedUrl === expectedSourceUrl &&
  sourcePopup?.activationRequestedUrl === expectedSourceUrl &&
  [expectedSourceUrl, sourcePopup?.finalUrl].includes(sourcePopup?.targetInitialUrl) &&
  sourcePopup?.targetFinalUrl === sourcePopup?.finalUrl &&
  sourceFinalUrlAllowed === true &&
  e5Ui.aboutMenu.popupTargets?.sourceFinalUrlAllowed === true &&
  sourcePopup?.targetOpenerId === null &&
  sourcePopup?.targetOpenerFrameId === null &&
  sourcePopup?.windowOpenerIsNull === true &&
  sourcePopup?.documentReadyState === 'complete' &&
  sourcePopup?.closed === true &&
  noticesPopup?.createdPageTargetCount === 1 &&
  typeof noticesPopup?.createdPageTargetId === 'string' &&
  noticesPopup?.targetType === 'page' &&
  noticesPopup?.requestedUrl === expectedNoticesUrl &&
  noticesPopup?.activationRequestedUrl === expectedNoticesUrl &&
  noticesPopup?.targetInitialUrl === expectedNoticesUrl &&
  noticesPopup?.finalUrl === expectedNoticesUrl &&
  noticesPopup?.targetFinalUrl === expectedNoticesUrl &&
  noticesPopup?.targetOpenerId === null &&
  noticesPopup?.targetOpenerFrameId === null &&
  noticesPopup?.windowOpenerIsNull === true &&
  noticesPopup?.documentReadyState === 'complete' &&
  noticesPopup?.closed === true &&
  e5Ui.aboutMenu.temporaryAnchorsRemaining === 0;
if (!aboutMenuAuditOk) {
  failures.push('E5 UI audit must prove one About menu with exactly Source code and Third-party notices, each activated through the exact safe new-tab link contract');
}

const noticesHttpAuditOk =
  e5Ui?.aboutMenu?.noticesHttp?.status === 200 &&
  e5Ui.aboutMenu.noticesHttp.url === expectedNoticesUrl &&
  typeof e5Ui.aboutMenu.noticesHttp.contentType === 'string' &&
  /^text\/plain(?:\s*;|$)/i.test(e5Ui.aboutMenu.noticesHttp.contentType) &&
  e5Ui.aboutMenu.noticesHttp.textPlain === true &&
  e5Ui.aboutMenu.noticesHttp.utf8 === true &&
  e5Ui.aboutMenu.noticesHttp.noAttachment === true &&
  !/attachment/i.test(e5Ui.aboutMenu.noticesHttp.contentDisposition ?? '');
if (!noticesHttpAuditOk) {
  failures.push('E5 notices URL must return HTTP 200 as UTF-8 text/plain without an attachment disposition');
}
const e5LegalUiAssertions = {
  aboutVisibleExactlyOncePerTheme:
    e5Ui?.themeQueries?.every(({ aboutVisible, aboutCount }) =>
      aboutVisible === true && aboutCount === 1) === true,
  aboutItemsExactlySourceAndNotices:
    e5Ui?.aboutMenu?.itemCount === 2 &&
    JSON.stringify(e5Ui.aboutMenu.items?.map(({ text }) => text)) === JSON.stringify(expectedAboutItems) &&
    e5Ui.aboutMenu.items?.every(({ role }) => role === 'menuitem') === true,
  aboutActiveItemUsesExactAccentSoft:
    e5Ui?.aboutMenu?.activeStyle?.active === true &&
    e5Ui.aboutMenu.activeStyle.exactSoftWithText === true &&
    e5Ui.aboutMenu.activeStyle.color === expectedText &&
    e5Ui.aboutMenu.activeStyle.backgroundColor === expectedAccentSoft,
  aboutSourceLinkExact:
    JSON.stringify(e5Ui?.aboutMenu?.activations?.[0]) === JSON.stringify(expectedAboutActivations[0]),
  aboutNoticesLinkExact:
    JSON.stringify(e5Ui?.aboutMenu?.activations?.[1]) === JSON.stringify(expectedAboutActivations[1]),
  aboutTemporaryAnchorsRemoved: e5Ui?.aboutMenu?.temporaryAnchorsRemaining === 0,
  aboutSourceNativePopupExactlyOne:
    sourcePopup?.createdPageTargetCount === 1 &&
    typeof sourcePopup.createdPageTargetId === 'string' &&
    sourcePopup.targetType === 'page' &&
    sourcePopup.requestedUrl === expectedSourceUrl &&
    sourcePopup.activationRequestedUrl === expectedSourceUrl &&
    [expectedSourceUrl, sourcePopup.finalUrl].includes(sourcePopup.targetInitialUrl) &&
    sourcePopup.targetFinalUrl === sourcePopup.finalUrl &&
    sourceFinalUrlAllowed === true &&
    sourcePopup.targetOpenerId === null &&
    sourcePopup.targetOpenerFrameId === null &&
    sourcePopup.windowOpenerIsNull === true &&
    sourcePopup.documentReadyState === 'complete' &&
    sourcePopup.closed === true,
  aboutNoticesNativePopupExactlyOne:
    noticesPopup?.createdPageTargetCount === 1 &&
    typeof noticesPopup.createdPageTargetId === 'string' &&
    noticesPopup.targetType === 'page' &&
    noticesPopup.requestedUrl === expectedNoticesUrl &&
    noticesPopup.activationRequestedUrl === expectedNoticesUrl &&
    noticesPopup.targetInitialUrl === expectedNoticesUrl &&
    noticesPopup.finalUrl === expectedNoticesUrl &&
    noticesPopup.targetFinalUrl === expectedNoticesUrl &&
    noticesPopup.targetOpenerId === null &&
    noticesPopup.targetOpenerFrameId === null &&
    noticesPopup.windowOpenerIsNull === true &&
    noticesPopup.documentReadyState === 'complete' &&
    noticesPopup.closed === true,
  noticesHttp200TextPlainUtf8NoAttachment: noticesHttpAuditOk,
  tinyLinkDialogUsesExactAccent:
    e5Ui?.tinyLinkDialogPalette?.exactAccent === true &&
    e5Ui.tinyLinkDialogPalette.focusedField === true &&
    e5Ui.tinyLinkDialogPalette.fieldBorderColor === expectedAccent &&
    typeof e5Ui.tinyLinkDialogPalette.fieldBoxShadow === 'string' &&
    e5Ui.tinyLinkDialogPalette.fieldBoxShadow.includes(expectedAccent) &&
    e5Ui.tinyLinkDialogPalette.saveButtonSelector === expectedTinyLinkSaveButtonSelector &&
    e5Ui.tinyLinkDialogPalette.saveButtonLabel === expectedTinyLinkSaveButtonLabel &&
    e5Ui.tinyLinkDialogPalette.saveButtonBackgroundColor === expectedAccent &&
    e5Ui.tinyLinkDialogPalette.saveButtonBorderColor === expectedAccent,
};
if (Object.values(e5LegalUiAssertions).some((value) => value !== true)) {
  failures.push('E5 named About/notices and Tiny dialog palette evidence assertions must all pass');
}

const viewportAuditOk =
  Array.isArray(e5Ui?.viewports) &&
  e5Ui.viewports.length === expectedViewports.length &&
  e5Ui.viewports.every((state, index) => {
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
  failures.push('E5 UI audit must prove desktop split at 1440/1024/900 and mobile tabs at 899/768/390/320 with nonzero editors and no horizontal overflow');
}

const coarseAuditOk =
  e5Ui?.coarsePointer?.emulated === true &&
  e5Ui.coarsePointer.hoverNone === true &&
  e5Ui.coarsePointer.emulationError === null &&
  Array.isArray(e5Ui.coarsePointer.controls) &&
  e5Ui.coarsePointer.controls.length > 0 &&
  e5Ui.coarsePointer.controls.every(({ atLeast44, width, height }) =>
    atLeast44 === true && width >= 43.5 && height >= 43.5) &&
  Array.isArray(e5Ui.coarsePointer.failures) &&
  e5Ui.coarsePointer.failures.length === 0 &&
  e5Ui.coarsePointer.allAtLeast44 === true;
if (!coarseAuditOk) {
  failures.push('E5 UI audit must prove every visible app/TinyMCE button is at least 44x44 under emulated coarse pointer input');
}

const expectedContrastPairs = [
  'text-on-surface',
  'text-on-background',
  'muted-on-surface',
  'muted-on-background',
  'surface-on-accent',
  'text-on-accent-soft',
  'muted-on-accent-soft',
];
const contrastAuditOk =
  e5Ui?.contrast?.allAtLeast4_5 === true &&
  e5Ui.contrast.paletteExact === true &&
  e5Ui.contrast.tokens?.accent === expectedAccent &&
  e5Ui.contrast.tokens?.['accent-soft'] === expectedAccentSoft &&
  Array.isArray(e5Ui.contrast.pairs) &&
  JSON.stringify(e5Ui.contrast.pairs.map(({ name }) => name)) === JSON.stringify(expectedContrastPairs) &&
  e5Ui.contrast.pairs.every(({ ratio }) => typeof ratio === 'number' && ratio >= 4.5) &&
  typeof e5Ui.contrast.minimum?.ratio === 'number' &&
  e5Ui.contrast.minimum.ratio >= 4.5;
if (!contrastAuditOk) failures.push('E5 UI audit must prove all seven permitted computed palette pairs, including text on accent-soft surfaces, are at least 4.5:1 and report the minimum');

if (e5Ui?.focus?.productButton !== true || e5Ui.focus.solidAccent !== true) {
  failures.push('E5 UI audit must prove a keyboard focus-visible outline is solid, at least 3px and uses --phe-accent');
}
if (
  e5Ui?.visualViewport?.available !== true ||
  e5Ui.visualViewport.resizeUpdated !== true
) {
  failures.push('E5 UI audit must prove visualViewport resize updates --phe-viewport-height and --phe-viewport-offset-top');
}
if (
  !e5Ui?.loadingLifecycle ||
  !Object.values(e5Ui.loadingLifecycle).every((value) => value === true)
) {
  failures.push('E5 UI audit must prove the visible busy skeleton transitions to two ready editors in both network scenarios');
}
const paintProofOk =
  e5Ui?.loadingPaintProof &&
  ['cold', 'cumulative'].every((scenario) => {
    const proof = e5Ui.loadingPaintProof[scenario];
    const metrics = e5Ui.loadingPerformanceMetrics?.[scenario];
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
  failures.push('E5 UI audit must prove the skeleton spans FP and FCP, reaches two ready editors, and records all three exact navigation/skeleton/editor-ready metrics');
}
const bootOrderingAuditOk = ['cold', 'cumulative'].every((scenario) =>
  bootOrderingOk(e5Ui?.bootOrdering?.[scenario])
);
if (!bootOrderingAuditOk) {
  failures.push('E5 canonical audit must prove one preloaded Tiny resource, one post-paint runtime script and runtime availability before initialise');
}
if (
  !e5Ui?.docxBusyLifecycle ||
  !Object.values(e5Ui.docxBusyLifecycle).every((value) => value === true)
) {
  failures.push('E5 UI audit must prove the DOCX busy/disabled state is painted before parsing and restored afterward');
}
if (!Array.isArray(e5Ui?.consoleProblems) || e5Ui.consoleProblems.length !== 0) {
  failures.push('E5 isolated UI audit contains console errors or warnings');
}
if (e5Ui?.allPassed !== true) failures.push('E5 isolated UI audit did not pass every strict assertion');

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
    name: 'Cumulative E5 transfer (gzip)',
    actual: cumulativeTransfer.gzip,
    budget: BYTE_BUDGETS.cumulative.gzip,
  },
  {
    name: 'Cumulative E5 transfer (brotli)',
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
  stage: 'E5',
  origin: expectedOrigin,
  manifestSha256,
  docxFixtureSha256,
  legalNavigationBudgetScope: expectedLegalNavigationBudgetScope,
  networkEvidenceBinding: {
    harResultSha256: createHash('sha256').update(harResultBytes).digest('hex'),
    artifactBindings: reportArtifactBindings,
    assertionNames: [...expectedE5AssertionNames],
    allAssertionsTrue: expectedE5AssertionNames.every((name) =>
      harResultReport.assertions?.[name] === true),
  },
  definitions: {
    cold: 'All production HTTP resources requested from navigation through editor-ready.',
    cumulative: 'A separate fresh production load containing every cold URL, first source focus, the complete E2 document-tools inventory, custom emoji search/insert, actual HTML and DOCX imports, HTML export, clipboard actions, product sample, draft autosave and new document; the only cumulative JavaScript additions are source-rich, safe replacement, Mammoth and the isolated regex Worker. E5 responsive/theme/accessibility checks run in a separate browser without Network enabled and cannot contaminate this byte inventory.',
    requestCount: 'Cold load through editor-ready only, including the HTML document.',
    initialJs: 'Supplementary, non-budget detail: cold-load JavaScript outside /tinymce; lazy source-editor tools are excluded.',
    legalTopLevelNavigations: 'Source code and Third-party notices open as independent top-level browsing contexts, not resources in the editor document graph. Their native-tab and HTTP-delivery proofs are validated separately and their bytes are intentionally excluded from editor cold/cumulative payload totals.',
    loadingPerformance: 'Local diagnostic navigation timeline in milliseconds: navigation start to the first skeleton paint, first skeleton paint to the fixed phe:bootstrap:editor-ready mark, and their exact total. The mark is reconciled to sampled nonzero DOM-ready state within 100 ms. These values are neither byte-budget inputs nor the deployed Slow-4G §7 input-readiness measurement.',
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
  e5LegalUiAssertions,
  supplementary: {
    initialJsWithoutTinyMCE: initialJsTransfer,
    largeDocumentCleanDurationMs: cumulativeReport.uiActionInventory?.largeDocumentCleanDurationMs ?? null,
    loadingPerformanceMetrics: e5Ui?.loadingPerformanceMetrics ?? null,
    tinyBootOrdering: e5Ui?.bootOrdering ?? null,
    e5UiValidation: e5Ui,
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

await writeFile(resolve(reportsRoot, 'size-e5-result.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output, null, 2));
if (failures.length > 0) process.exitCode = 1;
