import { createHash } from 'node:crypto';
import { access, readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';
import {
  TINYMCE_ASSETS,
  CUSTOM_EMOTICONS_DATABASE_ASSET,
  STOCK_EMOTICONS_DATABASE_ASSET,
  TINYMCE_EXCLUDED_DARK_ASSETS,
  TINYMCE_VENDOR_ASSETS,
} from './tinymce-assets.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const PROD_ROOT = resolve(ROOT, 'dist');
const DIAGNOSTIC_ROOT = resolve(ROOT, 'dist-e0');
const FIXTURES_ROOT = resolve(ROOT, 'tests/fixtures');
const DIAGNOSTIC_FIXTURES = [
  resolve(ROOT, 'tests/fixtures/mammoth-fixture.docx'),
  resolve(ROOT, 'tests/fixtures/mammoth-fixture.expected.html'),
];
const FORBIDDEN_MARKERS = [
  Buffer.from('mammoth-fixture'),
  Buffer.from('tests/fixtures'),
];

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...await walk(path));
    else if (entry.isFile()) files.push(path);
  }
  return files;
};

const fixtureFiles = await walk(FIXTURES_ROOT);
const [productionFiles, diagnosticFiles, fixtureBytes, diagnosticFixtureBytes] = await Promise.all([
  walk(PROD_ROOT),
  walk(DIAGNOSTIC_ROOT),
  Promise.all(fixtureFiles.map((path) => readFile(path))),
  Promise.all(DIAGNOSTIC_FIXTURES.map((path) => readFile(path))),
]);
const fixtureHashes = new Set(fixtureBytes.map(sha256));
const diagnosticFixtureHashes = diagnosticFixtureBytes.map(sha256);
const errors = [];

const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};

if (TINYMCE_VENDOR_ASSETS.includes(STOCK_EMOTICONS_DATABASE_ASSET)) {
  errors.push('stock TinyMCE emoji database remains in the vendor allow-list');
}
const includedDarkAssets = TINYMCE_EXCLUDED_DARK_ASSETS.filter((asset) =>
  TINYMCE_ASSETS.includes(asset));
if (includedDarkAssets.length > 0) {
  errors.push(`dark TinyMCE assets remain in the distribution allow-list: ${includedDarkAssets.join(', ')}`);
}
const expectedEmoticonsHash =
  'ae44bba7002ff59b2ffcd17b96bcd7b51c39dbbe4a07c767b1bab5c9201f4b19';
for (const [name, root] of [
  ['public', resolve(ROOT, 'public')],
  ['production', PROD_ROOT],
  ['diagnostic', DIAGNOSTIC_ROOT],
]) {
  const stockPath = resolve(root, 'tinymce', STOCK_EMOTICONS_DATABASE_ASSET);
  if (await exists(stockPath)) errors.push(`${name} contains the stock TinyMCE emoji database`);

  const customPath = resolve(root, 'tinymce', CUSTOM_EMOTICONS_DATABASE_ASSET);
  if (!(await exists(customPath))) {
    errors.push(`${name} is missing the generated common emoji database`);
  } else {
    const digest = sha256(await readFile(customPath));
    if (digest !== expectedEmoticonsHash) {
      errors.push(`${name} common emoji database SHA-256 differs: ${digest}`);
    }
  }
}

for (const [name, root] of [
  ['public', resolve(ROOT, 'public')],
  ['production', PROD_ROOT],
  ['diagnostic', DIAGNOSTIC_ROOT],
]) {
  for (const asset of TINYMCE_EXCLUDED_DARK_ASSETS) {
    if (await exists(resolve(root, 'tinymce', asset))) {
      errors.push(`${name} contains excluded dark TinyMCE asset: ${asset}`);
    }
  }
}

const tinyMceAssetReportText = await readFile(
  resolve(ROOT, 'reports', 'tinymce-assets.json'),
  'utf8',
);
const tinyMceAssetReport = JSON.parse(tinyMceAssetReportText);
if (/\b[A-Z]:\\/i.test(tinyMceAssetReportText) || /"(?:capturedAt|generatedAt)"/.test(tinyMceAssetReportText)) {
  errors.push('TinyMCE asset report contains a machine path or nondeterministic timestamp');
}
const reportedTinyMceAssets = Array.isArray(tinyMceAssetReport.assets)
  ? tinyMceAssetReport.assets
  : [];
const reportedTinyMcePaths = reportedTinyMceAssets.map(({ path }) => path);
if (JSON.stringify(reportedTinyMcePaths) !== JSON.stringify(TINYMCE_ASSETS)) {
  errors.push(
    `TinyMCE asset report inventory differs: ` +
      `${JSON.stringify(reportedTinyMcePaths)}/${JSON.stringify(TINYMCE_ASSETS)}`,
  );
}
for (const entry of reportedTinyMceAssets) {
  const publicPath = resolve(ROOT, 'public', 'tinymce', entry.path);
  if (!(await exists(publicPath))) {
    errors.push(`TinyMCE asset report points to a missing public file: ${entry.path}`);
    continue;
  }
  const bytes = await readFile(publicPath);
  if (entry.bytes !== bytes.byteLength || entry.sha256 !== sha256(bytes)) {
    errors.push(`TinyMCE asset report hash or byte count differs: ${entry.path}`);
  }
}

const emoticonsReportText = await readFile(resolve(ROOT, 'reports', 'emoticons-subset.json'), 'utf8');
const emoticonsReport = JSON.parse(emoticonsReportText);
if (/\b[A-Z]:\\/i.test(emoticonsReportText) || /"(?:capturedAt|generatedAt)"/.test(emoticonsReportText)) {
  errors.push('emoji reduction report contains a machine path or nondeterministic timestamp');
}
const expectedEmoticonsReport = {
  source: {
    entries: 1570,
    sha256: '66f71a7fc7094165772664ff37a327c75090fbc646186b7e89c6e39d0676cdf1',
    raw: 192805,
    gzip9: 28872,
    brotli11: 24449,
  },
  subset: {
    entries: 300,
    inventorySha256: '1f9d92018d716f1dcf03f9d506c1c4acc9b81737ccee9a0099e4b63288803ccc',
    sha256: expectedEmoticonsHash,
    raw: 38728,
    gzip9: 7244,
    brotli11: 6059,
  },
  coldSavings: { raw: 154077, gzip9: 21628, brotli11: 18390 },
};
for (const section of ['source', 'subset', 'coldSavings']) {
  for (const [key, expected] of Object.entries(expectedEmoticonsReport[section])) {
    if (emoticonsReport?.[section]?.[key] !== expected) {
      errors.push(
        `emoji reduction report ${section}.${key} differs: ` +
          `${JSON.stringify(emoticonsReport?.[section]?.[key])}/${JSON.stringify(expected)}`,
      );
    }
  }
}

for (const path of productionFiles) {
  const bytes = await readFile(path);
  const displayPath = relative(PROD_ROOT, path).replaceAll('\\', '/');
  if (extname(path).toLowerCase() === '.docx') {
    errors.push(`production contains DOCX: ${displayPath}`);
  }
  if (fixtureHashes.has(sha256(bytes))) {
    errors.push(`production contains a fixture payload: ${displayPath}`);
  }
  if (displayPath === 'index.html' && bytes.includes(Buffer.from('{{phe:'))) {
    errors.push('production index.html contains an unresolved static UI copy token');
  }
  for (const marker of FORBIDDEN_MARKERS) {
    if (bytes.includes(marker)) {
      errors.push(`production references ${marker.toString()}: ${displayPath}`);
    }
  }
}

const diagnosticHashes = new Map();
for (const path of diagnosticFiles) {
  const digest = sha256(await readFile(path));
  diagnosticHashes.set(digest, [...(diagnosticHashes.get(digest) ?? []), path]);
}
for (const [index, fixtureHash] of diagnosticFixtureHashes.entries()) {
  const matches = diagnosticHashes.get(fixtureHash) ?? [];
  if (matches.length !== 1) {
    errors.push(`diagnostic build must contain fixture ${DIAGNOSTIC_FIXTURES[index]} exactly once; found ${matches.length}`);
  }
}

const result = {
  productionFiles: productionFiles.length,
  diagnosticFiles: diagnosticFiles.length,
  emoticons: {
    stockAsset: STOCK_EMOTICONS_DATABASE_ASSET,
    customAsset: CUSTOM_EMOTICONS_DATABASE_ASSET,
    source: emoticonsReport.source,
    subset: emoticonsReport.subset,
    coldSavings: emoticonsReport.coldSavings,
  },
  fixtureFiles: fixtureFiles.map((path) => relative(ROOT, path).replaceAll('\\', '/')),
  fixtureHashes: [...fixtureHashes],
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) process.exitCode = 1;
