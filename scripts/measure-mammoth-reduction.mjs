/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'dist-e0');
const REPORT = resolve(ROOT, 'reports', 'mammoth-reduction-e3.json');
const BASELINE = Object.freeze({
  commit: 'dbe1de6',
  file: 'assets/lib-CFU1GAm2.js',
  sha256: '07efe870ce99960ad65dc9071ca6028cd5c127e1618ee49bd7053d9fed6f39f0',
  raw: 498_084,
  gzip9: 123_960,
  brotli11: 102_259,
});

const compressedSizes = (bytes) => ({
  raw: bytes.byteLength,
  gzip9: gzipSync(bytes, { level: 9 }).byteLength,
  brotli11: brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).byteLength,
});

const [manifestText, licenses] = await Promise.all([
  readFile(resolve(DIST, '.vite', 'manifest.json'), 'utf8'),
  readFile(resolve(DIST, 'licenses.txt'), 'utf8'),
]);
const manifest = JSON.parse(manifestText);
const entry = manifest['src/import/mammoth-browser.ts'];
if (!entry?.isDynamicEntry || typeof entry.file !== 'string') {
  throw new Error('Diagnostic manifest has no lazy src/import/mammoth-browser.ts entry');
}

const bytes = await readFile(resolve(DIST, entry.file));
const optimized = {
  file: entry.file,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  ...compressedSizes(bytes),
};
const saved = {
  raw: BASELINE.raw - optimized.raw,
  gzip9: BASELINE.gzip9 - optimized.gzip9,
  brotli11: BASELINE.brotli11 - optimized.brotli11,
};

const requiredNotices = [
  /^## mammoth - 1\.12\.1 \(BSD-2-Clause\)$/m,
  /^## underscore - 1\.13\.8 \(MIT\)$/m,
  /^## dingbat-to-unicode - 1\.0\.1 \(BSD-2-Clause\)$/m,
];
const forbiddenNotices = [/^## bluebird\b/m, /^## xmlbuilder\b/m];
const failures = [];
for (const pattern of requiredNotices) {
  if (!pattern.test(licenses)) failures.push(`Missing built notice ${pattern}`);
}
for (const pattern of forbiddenNotices) {
  if (pattern.test(licenses)) failures.push(`Dead dependency remains in built notices: ${pattern}`);
}
if (saved.gzip9 < 30_000 || saved.brotli11 < 25_000) {
  failures.push(`Mammoth reduction regressed: saved ${saved.gzip9} gzip / ${saved.brotli11} brotli`);
}

const report = {
  schemaVersion: 1,
  stage: 'E3',
  toolchain: {
    vite: '8.2.1',
    mammoth: '1.12.1',
    underscore: '1.13.8',
    targets: ['es2020', 'chrome111', 'edge111', 'firefox114', 'safari16'],
    compression: { gzipLevel: 9, brotliQuality: 11 },
  },
  scope: 'Exact project E0 lazy Mammoth chunk; application and fixture assets excluded',
  baseline: BASELINE,
  optimized,
  saved,
  retainedRuntime: ['mammoth', 'underscore', 'dingbat-to-unicode'],
  removedFromBrowserChunk: ['bluebird', 'xmlbuilder'],
  validation: {
    projectGolden: 'tests/import/mammoth-browser.test.ts',
    warningInventory: 'empty',
    wingdings: 'w:sym Wingdings F04A -> U+263A',
  },
  failures,
};

await writeFile(REPORT, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
