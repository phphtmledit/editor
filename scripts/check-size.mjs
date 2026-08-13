import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import { TINYMCE_ASSETS } from './tinymce-assets.mjs';

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
  '/tinymce/plugins/emoticons/js/emojis.min.js',
  '/tinymce/skins/ui/oxide/skin.min.css',
  '/tinymce/skins/ui/oxide/content.min.css',
  '/tinymce/skins/content/default/content.min.css',
];

const [coldReport, fullReport] = await Promise.all([
  readFile(resolve(reportsRoot, 'network-cold.json'), 'utf8').then(JSON.parse),
  readFile(resolve(reportsRoot, 'network-full.json'), 'utf8').then(JSON.parse),
]);
const manifest = JSON.parse(await readFile(resolve(distRoot, '.vite', 'manifest.json'), 'utf8'));
const mammothEntries = Object.values(manifest).filter(
  (entry) => entry?.isDynamicEntry === true && /(?:^|\/)mammoth\/lib\/index\.js$/.test(entry.src),
);
if (mammothEntries.length !== 1 || typeof mammothEntries[0]?.file !== 'string') {
  failures.push(`dist manifest must have exactly one Mammoth dynamic entry, got ${mammothEntries.length}`);
}
const mammothEntry = mammothEntries.length === 1 && typeof mammothEntries[0].file === 'string'
  ? mammothEntries[0]
  : null;

const assertReportShape = (name, report) => {
  if (!report || typeof report !== 'object') throw new TypeError(`${name}: report must be an object`);
  if (typeof report.pageUrl !== 'string') throw new TypeError(`${name}: pageUrl must be a string`);
  if (!Array.isArray(report.requests)) throw new TypeError(`${name}: requests must be an array`);
  if (report.requests.length === 0) failures.push(`${name}: network capture is empty`);
  if (typeof report.capturedAt !== 'string' || Number.isNaN(Date.parse(report.capturedAt))) {
    failures.push(`${name}: capturedAt is missing or invalid`);
  }
  for (const [index, request] of report.requests.entries()) {
    if (!request || typeof request !== 'object' || typeof request.url !== 'string') {
      throw new TypeError(`${name}: request ${index} has no URL`);
    }
  }
};

assertReportShape('cold', coldReport);
assertReportShape('full', fullReport);

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

const [coldRows, fullRows] = await Promise.all([
  analyseScenario('cold', coldReport),
  analyseScenario('full', fullReport),
]);

const pathname = ({ url }) => new URL(url).pathname;
const isDiagnosticFixturePath = (path) =>
  path.toLowerCase().endsWith('.docx') ||
  /(?:mammoth-fixture|tests\/fixtures)/i.test(path);
const coldPaths = new Set(coldReport.requests.map(pathname));
const coldUrls = new Set(coldReport.requests.map(({ url }) => url));
const fullUrls = new Set(fullReport.requests.map(({ url }) => url));

for (const requiredPath of REQUIRED_COLD_PATHS) {
  if (!coldPaths.has(requiredPath)) failures.push(`cold: required request is missing: ${requiredPath}`);
}
if (![...coldPaths].some((path) => path.startsWith('/assets/') && path.endsWith('.js'))) {
  failures.push('cold: application JavaScript request is missing');
}
if (![...coldPaths].some((path) => path.startsWith('/assets/') && path.endsWith('.css'))) {
  failures.push('cold: application CSS request is missing');
}
for (const coldUrl of coldUrls) {
  if (!fullUrls.has(coldUrl)) failures.push(`full: cold request is missing: ${coldUrl}`);
}
const fullOnlyPaths = fullReport.requests
  .filter(({ url }) => !coldUrls.has(url))
  .map(pathname);
const mammothPath = mammothEntry ? `/${mammothEntry.file}` : null;
const fullMammothRequests = mammothPath
  ? fullReport.requests.filter((request) => pathname(request) === mammothPath)
  : [];
if (mammothPath && fullMammothRequests.length !== 1) {
  failures.push(
    `full: expected exactly one lazy Mammoth request for ${mammothPath}, got ${fullMammothRequests.length}`,
  );
}
if (mammothPath && coldPaths.has(mammothPath)) {
  failures.push(`cold: lazy Mammoth was requested before full interaction: ${mammothPath}`);
}
for (const path of fullOnlyPaths.filter((path) => path.endsWith('.js'))) {
  if (path !== mammothPath) failures.push(`full: unexpected full-only JavaScript request: ${path}`);
}
for (const path of fullReport.requests.map(pathname).filter(isDiagnosticFixturePath)) {
  failures.push(`full: production capture contains a diagnostic fixture: ${path}`);
}
if (Date.parse(fullReport.capturedAt) < Date.parse(coldReport.capturedAt)) {
  failures.push('full: capture predates the cold capture');
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
  gzip: sum(fullRows, 'gzip'),
  brotli: sum(fullRows, 'brotli'),
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
    name: 'Full cumulative transfer (gzip)',
    actual: cumulativeTransfer.gzip,
    budget: BYTE_BUDGETS.cumulative.gzip,
  },
  {
    name: 'Full cumulative transfer (brotli)',
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

const allUrls = [...coldReport.requests, ...fullReport.requests].map(({ url }) => url);
const defaultIconRequests = allUrls.filter(
  (rawUrl) => new URL(rawUrl).pathname === '/tinymce/icons/default/icons.min.js',
);
const coldCustomIconRequests = coldReport.requests.filter(
  ({ url }) => new URL(url).pathname === '/tinymce/icons/phphtmledit/icons.min.js',
);
if (defaultIconRequests.length > 0) {
  failures.push('Stock TinyMCE default icon bundle was requested');
}
if (coldCustomIconRequests.length !== 1) {
  failures.push(`Expected exactly one cold custom-icon request, got ${coldCustomIconRequests.length}`);
}
const tinyDomainRequests = allUrls.filter((rawUrl) => {
  const hostname = new URL(rawUrl).hostname.toLowerCase();
  return hostname === 'tiny.cloud' || hostname.endsWith('.tiny.cloud')
    || hostname === 'tinymce.com' || hostname.endsWith('.tinymce.com');
});
if (tinyDomainRequests.length > 0) failures.push('Tiny Cloud/domain requests were observed');

const output = {
  origin: expectedOrigin,
  definitions: {
    cold: 'All production HTTP resources requested from navigation through editor-ready.',
    cumulative: 'All production HTTP resources in the full interaction capture, which must contain every cold URL and the one lazy Mammoth chunk; diagnostic fixtures are forbidden.',
    requestCount: 'Cold load through editor-ready only, including the HTML document.',
    initialJs: 'Supplementary, non-budget detail: cold-load JavaScript outside /tinymce; lazy Mammoth is excluded.',
  },
  metrics,
  coldEditorReadyTransfer: {
    requests: coldReport.requests.length,
    ...coldTransfer,
  },
  cumulativeTransfer: {
    requests: fullReport.requests.length,
    ...cumulativeTransfer,
  },
  supplementary: {
    initialJsWithoutTinyMCE: initialJsTransfer,
  },
  activeLightTinyStaticFootprint,
  tinyStaticFootprint,
  tinyDomainRequests,
  scenarios: {
    cold: { capturedAt: coldReport.capturedAt, requests: coldRows },
    full: { capturedAt: fullReport.capturedAt, requests: fullRows },
  },
  failures,
};

await writeFile(resolve(reportsRoot, 'size-result.json'), `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(output, null, 2));
if (failures.length > 0) process.exitCode = 1;
