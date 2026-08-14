/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { createHash } from 'node:crypto';
import { access, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import {
  TINYMCE_ASSETS,
  TINYMCE_EXCLUDED_DARK_ASSETS,
  TINYMCE_VENDOR_ASSETS,
  TINYMCE_VERSION,
} from './tinymce-assets.mjs';

const ROOT = resolve(import.meta.dirname, '..');
const REPORT_PATH = resolve(ROOT, 'reports', 'dark-assets-removal-e4.json');
const FULL_LICENSE_ASSET = 'license.md';

const ACCEPTED_E3 = Object.freeze({
  evidenceFile: 'reports/size-e3-result.json',
  evidenceCanonicalSha256: '6776a54220cd65277ebe54f3b54f66ce724635d821d4dbe1584cd8c5c84eb0f0',
  productionManifestSha256: '01024a4ce4f2bfa3ae99705448ad9aa1c0b72cfc66e5657cca12002f24ebbb6f',
  tinymceAssetInventoryFile: 'reports/tinymce-assets.json',
  tinymceAssetInventoryCanonicalSha256:
    '62ede0d4dc9d467f2b171c74f6bfc2d132f26adbcb8b8de1f25235e8ab109249',
  cold: { requests: 18, gzip9: 569_631, brotli11: 484_561 },
  cumulative: { requests: 22, gzip9: 713_603, brotli11: 601_697 },
  staticFootprintsIncludingFullLicenseText: {
    beforeRemoval: { files: 20, raw: 1_648_032, gzip9: 464_506, brotli11: 393_573 },
    lightOnly: { files: 17, raw: 1_425_123, gzip9: 431_188, brotli11: 365_500 },
  },
  assetCounts: {
    vendorCopiesPlusGeneratedIconPack: 19,
    distributionExcludingFullLicenseText: 19,
    reportEntriesIncludingFullLicenseText: 20,
    byteIdenticalVendorFiles: 18,
  },
});

const EXPECTED_DARK_ASSETS = Object.freeze([
  Object.freeze({
    path: 'skins/ui/oxide-dark/skin.min.css',
    sha256: '51a73cf0b2df858e9e76c4bd0aa3e0d88d680c11727cfafb4662fa923fc89366',
    raw: 178_474,
    gzip9: 24_762,
    brotli11: 20_564,
  }),
  Object.freeze({
    path: 'skins/ui/oxide-dark/content.min.css',
    sha256: '834ed38a2494c5dbb49070bfc81f4c018587ed9e55a9f43f3cda7937549a472b',
    raw: 42_917,
    gzip9: 7_870,
    brotli11: 6_958,
  }),
  Object.freeze({
    path: 'skins/content/dark/content.min.css',
    sha256: '68f1f973a688fab3de5c39334743c00ff962abc78d38dc33ca959ecf72be0574',
    raw: 1_518,
    gzip9: 686,
    brotli11: 551,
  }),
]);

const EXPECTED_TOTALS = Object.freeze({
  beforeRemoval: Object.freeze({ files: 19, raw: 1_647_253, gzip9: 464_037, brotli11: 393_270 }),
  afterRemoval: Object.freeze({ files: 16, raw: 1_424_344, gzip9: 430_719, brotli11: 365_197 }),
  saved: Object.freeze({ files: 3, raw: 222_909, gzip9: 33_318, brotli11: 28_073 }),
});

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const canonicalJsonSha256 = (value) =>
  sha256(Buffer.from(JSON.stringify(value), 'utf8'));
const compressedSizes = (bytes) => ({
  raw: bytes.byteLength,
  gzip9: gzipSync(bytes, { level: 9 }).byteLength,
  brotli11: brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).byteLength,
});
const sumRows = (rows) => ({
  files: rows.length,
  raw: rows.reduce((total, row) => total + row.raw, 0),
  gzip9: rows.reduce((total, row) => total + row.gzip9, 0),
  brotli11: rows.reduce((total, row) => total + row.brotli11, 0),
});
const addTotals = (left, right) => ({
  files: left.files + right.files,
  raw: left.raw + right.raw,
  gzip9: left.gzip9 + right.gzip9,
  brotli11: left.brotli11 + right.brotli11,
});
const exists = async (path) => {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
};
const compareObject = (actual, expected) =>
  JSON.stringify(actual) === JSON.stringify(expected);

const failures = [];
const e3Evidence = JSON.parse(
  await readFile(resolve(ROOT, ACCEPTED_E3.evidenceFile), 'utf8'),
);
const e3EvidenceCanonicalSha256 = canonicalJsonSha256(e3Evidence);
if (e3EvidenceCanonicalSha256 !== ACCEPTED_E3.evidenceCanonicalSha256) {
  failures.push(
    `Accepted E3 size evidence changed: ${e3EvidenceCanonicalSha256}/` +
      ACCEPTED_E3.evidenceCanonicalSha256,
  );
}
if (
  e3Evidence.stage !== 'E3' ||
  e3Evidence.manifestSha256 !== ACCEPTED_E3.productionManifestSha256 ||
  !compareObject(e3Evidence.coldEditorReadyTransfer, {
    requests: ACCEPTED_E3.cold.requests,
    gzip: ACCEPTED_E3.cold.gzip9,
    brotli: ACCEPTED_E3.cold.brotli11,
  }) ||
  !compareObject(e3Evidence.cumulativeTransfer, {
    requests: ACCEPTED_E3.cumulative.requests,
    gzip: ACCEPTED_E3.cumulative.gzip9,
    brotli: ACCEPTED_E3.cumulative.brotli11,
  }) ||
  !compareObject(
    {
      files: e3Evidence.tinyStaticFootprint?.files,
      raw: e3Evidence.tinyStaticFootprint?.raw,
      gzip9: e3Evidence.tinyStaticFootprint?.gzip,
      brotli11: e3Evidence.tinyStaticFootprint?.brotli,
    },
    ACCEPTED_E3.staticFootprintsIncludingFullLicenseText.beforeRemoval,
  ) ||
  !compareObject(
    {
      files: e3Evidence.activeLightTinyStaticFootprint?.files,
      raw: e3Evidence.activeLightTinyStaticFootprint?.raw,
      gzip9: e3Evidence.activeLightTinyStaticFootprint?.gzip,
      brotli11: e3Evidence.activeLightTinyStaticFootprint?.brotli,
    },
    ACCEPTED_E3.staticFootprintsIncludingFullLicenseText.lightOnly,
  ) ||
  !Array.isArray(e3Evidence.failures) ||
  e3Evidence.failures.length !== 0
) {
  failures.push('Accepted E3 manifest, transfer metrics or failure inventory differs');
}

if (JSON.stringify(TINYMCE_EXCLUDED_DARK_ASSETS) !== JSON.stringify(
  EXPECTED_DARK_ASSETS.map(({ path }) => path),
)) {
  failures.push('Excluded TinyMCE dark asset inventory differs from the pinned E3 baseline');
}

const includedDarkAssets = TINYMCE_EXCLUDED_DARK_ASSETS.filter((path) =>
  TINYMCE_ASSETS.includes(path));
if (includedDarkAssets.length > 0) {
  failures.push(`Dark assets remain in the distribution allow-list: ${includedDarkAssets.join(', ')}`);
}

const darkRows = [];
for (const expected of EXPECTED_DARK_ASSETS) {
  const bytes = await readFile(resolve(ROOT, 'node_modules', 'tinymce', expected.path));
  const actual = { path: expected.path, sha256: sha256(bytes), ...compressedSizes(bytes) };
  darkRows.push(actual);
  if (!compareObject(actual, expected)) {
    failures.push(`Pinned TinyMCE dark asset differs: ${expected.path}`);
  }
}

const retainedAssetPaths = TINYMCE_ASSETS.filter((path) => path !== FULL_LICENSE_ASSET);
if (retainedAssetPaths.length !== EXPECTED_TOTALS.afterRemoval.files) {
  failures.push(
    `Post-removal distribution count differs: ` +
      `${retainedAssetPaths.length}/${EXPECTED_TOTALS.afterRemoval.files}`,
  );
}
if (TINYMCE_ASSETS.length !== 17 || TINYMCE_VENDOR_ASSETS.length !== 15) {
  failures.push(
    `Post-removal reported/vendor counts differ: ${TINYMCE_ASSETS.length}/17, ` +
      `${TINYMCE_VENDOR_ASSETS.length}/15`,
  );
}

const retainedRows = [];
for (const path of retainedAssetPaths) {
  const bytes = await readFile(resolve(ROOT, 'public', 'tinymce', path));
  retainedRows.push({ path, sha256: sha256(bytes), ...compressedSizes(bytes) });
}

const absenceByRoot = {};
for (const rootName of ['public', 'dist', 'dist-e0']) {
  const present = [];
  for (const path of TINYMCE_EXCLUDED_DARK_ASSETS) {
    if (await exists(resolve(ROOT, rootName, 'tinymce', path))) present.push(path);
  }
  absenceByRoot[rootName] = present.length === 0;
  if (present.length > 0) {
    failures.push(`${rootName} contains excluded TinyMCE dark assets: ${present.join(', ')}`);
  }
}

const afterRemoval = sumRows(retainedRows);
const saved = sumRows(darkRows);
const beforeRemoval = addTotals(afterRemoval, saved);
for (const [name, actual] of Object.entries({ beforeRemoval, afterRemoval, saved })) {
  if (!compareObject(actual, EXPECTED_TOTALS[name])) {
    failures.push(
      `${name} totals differ: ${JSON.stringify(actual)}/${JSON.stringify(EXPECTED_TOTALS[name])}`,
    );
  }
}

const report = {
  schemaVersion: 1,
  stage: 'E4 prerequisite',
  tinymceVersion: TINYMCE_VERSION,
  scope:
    'Isolated sum of per-file raw, gzip-9 and Brotli-11 sizes for the TinyMCE distribution allow-list, excluding the separately delivered full license.md text.',
  acceptedE3Baseline: ACCEPTED_E3,
  countReconciliation: {
    vendorCopiesPlusGeneratedIconPack: {
      before: 19,
      after: 16,
    },
    distributionAssetsExcludingFullLicenseText: {
      before: 19,
      after: 16,
    },
    reportEntriesIncludingFullLicenseText: {
      before: 20,
      after: 17,
    },
    byteIdenticalVendorFiles: {
      before: 18,
      after: 15,
    },
  },
  compression: { gzipLevel: 9, brotliQuality: 11, aggregation: 'sum of each file' },
  beforeRemoval,
  afterRemoval,
  removedAssets: darkRows,
  saved,
  validation: {
    e3EvidenceCanonicalSha256,
    retainedInventoryCanonicalSha256: canonicalJsonSha256(retainedRows),
    excludedFromDistributionAllowList: includedDarkAssets.length === 0,
    absentByRoot: absenceByRoot,
  },
  failures,
};

await writeFile(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exitCode = 1;
