import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { extname, relative, resolve } from 'node:path';

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

for (const path of productionFiles) {
  const bytes = await readFile(path);
  const displayPath = relative(PROD_ROOT, path).replaceAll('\\', '/');
  if (extname(path).toLowerCase() === '.docx') {
    errors.push(`production contains DOCX: ${displayPath}`);
  }
  if (fixtureHashes.has(sha256(bytes))) {
    errors.push(`production contains a fixture payload: ${displayPath}`);
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
  fixtureFiles: fixtureFiles.map((path) => relative(ROOT, path).replaceAll('\\', '/')),
  fixtureHashes: [...fixtureHashes],
  errors,
};

console.log(JSON.stringify(result, null, 2));
if (errors.length > 0) process.exitCode = 1;
