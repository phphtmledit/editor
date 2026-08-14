import { createHash } from 'node:crypto';
import { access, readFile, realpath } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  CUSTOM_EMOTICONS_DATABASE_ASSET,
  STOCK_EMOTICONS_DATABASE_ASSET,
  TINYMCE_VENDOR_ASSETS,
  TINYMCE_VERSION,
} from './tinymce-assets.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const THIRD_PARTY_DIR = join(ROOT, 'third-party-licenses');
const NOTICES_FILE = join(ROOT, 'THIRD-PARTY-NOTICES.md');
const DUCK_LICENSE_SHA256 =
  '6663bbd049205d38a496ccacb412a151980b444627d38de218b3b809aef330f1';
const GPL_V2_TEXT_SHA256 =
  'a78aa507531e05215fec3b74f0d130bb38fd3518bd3fb5292fa364976242ea89';
const EXPECTED_EMOTICONS_NOTICE_ROW =
  '| Derived common emoji database (`emojis-common`) | Generated from the TinyMCE 8.8.2 ' +
  'emoji database (source data: `emojilib@2.4.0`); contains 300 selected entries; names, ' +
  'keywords, Unicode characters, categories and Fitzpatrick metadata are unaltered | MIT ' +
  '(emojilib data) AND GPL-2.0-or-later (TinyMCE Resource wrapper and phphtmledit ' +
  'modifications) | Emoji data Copyright (c) 2014 Mu-An Chiou; TinyMCE wrapper Copyright ' +
  '(c) 2025 Ephox Corporation DBA Tiny Technologies, Inc. |';

const EXPECTED_DIRECT_RUNTIME = Object.freeze({
  '@codemirror/autocomplete': '6.20.3',
  '@codemirror/commands': '6.10.4',
  '@codemirror/lang-html': '6.4.12',
  '@codemirror/language': '6.12.4',
  '@codemirror/search': '6.7.1',
  '@codemirror/state': '6.7.1',
  '@codemirror/view': '6.43.8',
  '@lezer/html': '1.3.13',
  mammoth: '1.12.1',
  tinymce: '8.8.2',
  underscore: '1.13.8',
});

const EXPECTED_RUNTIME = Object.freeze([
  ['@codemirror/autocomplete', '6.20.3', 'MIT', 'npm/codemirror-autocomplete-6.20.3-LICENSE', 'LICENSE'],
  ['@codemirror/commands', '6.10.4', 'MIT', 'npm/codemirror-commands-6.10.4-LICENSE', 'LICENSE'],
  ['@codemirror/lang-css', '6.3.1', 'MIT', 'npm/codemirror-lang-css-6.3.1-LICENSE', 'LICENSE'],
  ['@codemirror/lang-html', '6.4.12', 'MIT', 'npm/codemirror-lang-html-6.4.12-LICENSE', 'LICENSE'],
  ['@codemirror/lang-javascript', '6.2.5', 'MIT', 'npm/codemirror-lang-javascript-6.2.5-LICENSE', 'LICENSE'],
  ['@codemirror/language', '6.12.4', 'MIT', 'npm/codemirror-language-6.12.4-LICENSE', 'LICENSE'],
  ['@codemirror/lint', '6.9.7', 'MIT', 'npm/codemirror-lint-6.9.7-LICENSE', 'LICENSE'],
  ['@codemirror/search', '6.7.1', 'MIT', 'npm/codemirror-search-6.7.1-LICENSE', 'LICENSE'],
  ['@codemirror/state', '6.7.1', 'MIT', 'npm/codemirror-state-6.7.1-LICENSE', 'LICENSE'],
  ['@codemirror/view', '6.43.8', 'MIT', 'npm/codemirror-view-6.43.8-LICENSE', 'LICENSE'],
  ['@lezer/common', '1.5.2', 'MIT', 'npm/lezer-common-1.5.2-LICENSE', 'LICENSE'],
  ['@lezer/css', '1.3.6', 'MIT', 'npm/lezer-css-1.3.6-LICENSE', 'LICENSE'],
  ['@lezer/highlight', '1.2.3', 'MIT', 'npm/lezer-highlight-1.2.3-LICENSE', 'LICENSE'],
  ['@lezer/html', '1.3.13', 'MIT', 'npm/lezer-html-1.3.13-LICENSE', 'LICENSE'],
  ['@lezer/javascript', '1.5.4', 'MIT', 'npm/lezer-javascript-1.5.4-LICENSE', 'LICENSE'],
  ['@lezer/lr', '1.4.10', 'MIT', 'npm/lezer-lr-1.4.10-LICENSE', 'LICENSE'],
  ['@marijn/find-cluster-break', '1.0.3', 'MIT', 'npm/marijn-find-cluster-break-1.0.3-LICENSE', 'LICENSE'],
  ['@xmldom/xmldom', '0.8.14', 'MIT', 'npm/@xmldom-xmldom-0.8.14-LICENSE', 'LICENSE'],
  ['argparse', '1.0.10', 'MIT', 'npm/argparse-1.0.10-LICENSE', 'LICENSE'],
  ['base64-js', '1.5.1', 'MIT', 'npm/base64-js-1.5.1-LICENSE', 'LICENSE'],
  ['bluebird', '3.4.7', 'MIT', 'npm/bluebird-3.4.7-LICENSE', 'LICENSE'],
  ['core-util-is', '1.0.3', 'MIT', 'npm/core-util-is-1.0.3-LICENSE', 'LICENSE'],
  ['crelt', '1.0.7', 'MIT', 'npm/crelt-1.0.7-LICENSE', 'LICENSE'],
  ['dingbat-to-unicode', '1.0.1', 'BSD-2-Clause', null, null],
  ['duck', '0.1.12', 'BSD', 'npm/duck-0.1.12-LICENSE', 'LICENSE'],
  ['immediate', '3.0.6', 'MIT', 'npm/immediate-3.0.6-LICENSE.txt', 'LICENSE.txt'],
  ['inherits', '2.0.4', 'ISC', 'npm/inherits-2.0.4-LICENSE', 'LICENSE'],
  ['isarray', '1.0.0', 'MIT', 'npm/isarray-1.0.0-README.md', 'README.md'],
  ['jszip', '3.10.1', '(MIT OR GPL-3.0-or-later)', 'npm/jszip-3.10.1-LICENSE.markdown', 'LICENSE.markdown'],
  ['lie', '3.3.0', 'MIT', 'npm/lie-3.3.0-license.md', 'license.md'],
  ['lop', '0.4.2', 'BSD-2-Clause', 'npm/lop-0.4.2-LICENSE', 'LICENSE'],
  ['mammoth', '1.12.1', 'BSD-2-Clause', 'npm/mammoth-1.12.1-LICENSE', 'LICENSE'],
  ['option', '0.2.4', 'BSD-2-Clause', 'npm/option-0.2.4-LICENSE', 'LICENSE'],
  ['pako', '1.0.11', '(MIT AND Zlib)', 'npm/pako-1.0.11-LICENSE', 'LICENSE'],
  ['path-is-absolute', '1.0.1', 'MIT', 'npm/path-is-absolute-1.0.1-license', 'license'],
  ['process-nextick-args', '2.0.1', 'MIT', 'npm/process-nextick-args-2.0.1-license.md', 'license.md'],
  ['readable-stream', '2.3.8', 'MIT', 'npm/readable-stream-2.3.8-LICENSE', 'LICENSE'],
  ['safe-buffer', '5.1.2', 'MIT', 'npm/safe-buffer-5.1.2-LICENSE', 'LICENSE'],
  ['setimmediate', '1.0.5', 'MIT', 'npm/setimmediate-1.0.5-LICENSE.txt', 'LICENSE.txt'],
  ['sprintf-js', '1.0.3', 'BSD-3-Clause', 'npm/sprintf-js-1.0.3-LICENSE', 'LICENSE'],
  ['string_decoder', '1.1.1', 'MIT', 'npm/string_decoder-1.1.1-LICENSE', 'LICENSE'],
  ['style-mod', '4.1.3', 'MIT', 'npm/style-mod-4.1.3-LICENSE', 'LICENSE'],
  ['tinymce', '8.8.2', 'SEE LICENSE IN license.md', 'npm/tinymce-8.8.2-license.md', 'license.md'],
  ['underscore', '1.13.8', 'MIT', 'npm/underscore-1.13.8-LICENSE', 'LICENSE'],
  ['util-deprecate', '1.0.2', 'MIT', 'npm/util-deprecate-1.0.2-LICENSE', 'LICENSE'],
  ['w3c-keyname', '2.2.8', 'MIT', 'npm/w3c-keyname-2.2.8-LICENSE', 'LICENSE'],
  ['xmlbuilder', '10.1.1', 'MIT', 'npm/xmlbuilder-10.1.1-LICENSE', 'LICENSE'],
].map(([name, version, declaredLicense, licenseCopy, licenseSource]) => ({
  name,
  version,
  declaredLicense,
  licenseCopy,
  licenseSource,
})));

const EXPECTED_BY_ID = new Map(
  EXPECTED_RUNTIME.map((entry) => [`${entry.name}@${entry.version}`, entry]),
);

const errors = [];
const warnings = [];

const fail = (message) => {
  errors.push(message);
};

async function exists(path) {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function readText(path) {
  return readFile(path, 'utf8');
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

function normalizeText(value) {
  return value.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n').trimEnd();
}

function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

function equalObjects(actual, expected) {
  return JSON.stringify(
    Object.fromEntries(Object.entries(actual ?? {}).sort(([a], [b]) => a.localeCompare(b))),
  ) === JSON.stringify(
    Object.fromEntries(Object.entries(expected).sort(([a], [b]) => a.localeCompare(b))),
  );
}

async function findInstalledPackage(name, fromDirectory) {
  const packageSegments = name.split('/');
  let cursor = fromDirectory;

  for (;;) {
    const manifestPath = join(cursor, 'node_modules', ...packageSegments, 'package.json');
    if (await exists(manifestPath)) {
      return {
        directory: dirname(manifestPath),
        manifestPath,
      };
    }

    const parent = dirname(cursor);
    if (parent === cursor) {
      throw new Error(`Cannot resolve runtime dependency ${name} from ${fromDirectory}`);
    }
    cursor = parent;
  }
}

async function collectRuntimeGraph(rootManifest) {
  const queue = Object.keys(rootManifest.dependencies ?? {}).map((name) => ({
    name,
    fromDirectory: ROOT,
    optional: false,
  }));
  const visitedDirectories = new Set();
  const packages = [];

  while (queue.length > 0) {
    const request = queue.shift();
    let installed;
    try {
      installed = await findInstalledPackage(request.name, request.fromDirectory);
    } catch (error) {
      if (request.optional) {
        continue;
      }
      throw error;
    }

    const canonicalDirectory = await realpath(installed.directory);
    if (visitedDirectories.has(canonicalDirectory)) {
      continue;
    }
    visitedDirectories.add(canonicalDirectory);

    const manifest = await readJson(installed.manifestPath);
    packages.push({
      directory: installed.directory,
      manifest,
    });

    for (const name of Object.keys(manifest.dependencies ?? {})) {
      queue.push({
        name,
        fromDirectory: installed.directory,
        optional: false,
      });
    }
    for (const name of Object.keys(manifest.optionalDependencies ?? {})) {
      queue.push({
        name,
        fromDirectory: installed.directory,
        optional: true,
      });
    }
  }

  return packages;
}

async function verifyCopiedLicense(entry, packageDirectory) {
  if (entry.licenseCopy === null) {
    return;
  }

  const source = join(packageDirectory, entry.licenseSource);
  const copy = join(THIRD_PARTY_DIR, entry.licenseCopy);
  if (!(await exists(source))) {
    fail(`${entry.name}@${entry.version}: missing published license source ${entry.licenseSource}`);
    return;
  }
  if (!(await exists(copy))) {
    fail(`${entry.name}@${entry.version}: missing preserved license copy ${relative(ROOT, copy)}`);
    return;
  }

  const [sourceText, copyText] = await Promise.all([readText(source), readText(copy)]);
  if (normalizeText(sourceText) !== normalizeText(copyText)) {
    fail(`${entry.name}@${entry.version}: preserved license copy differs from the installed package`);
  }
}

async function verifyDuck(entry, packageDirectory) {
  const licensePath = join(packageDirectory, 'LICENSE');
  const bytes = await readFile(licensePath);
  const digest = sha256(bytes);
  if (digest !== DUCK_LICENSE_SHA256) {
    fail(
      `${entry.name}@${entry.version}: legacy "BSD" metadata may only be normalized after exact ` +
        `BSD-2-Clause LICENSE verification; expected ${DUCK_LICENSE_SHA256}, got ${digest}`,
    );
    return 'BSD (unverified)';
  }
  return 'BSD-2-Clause';
}

async function verifyPako(packageDirectory) {
  const readme = await readText(join(packageDirectory, 'README.md'));
  if (
    !readme.includes('MIT - all files, except `/lib/zlib` folder') ||
    !readme.includes('ZLIB - `/lib/zlib` content')
  ) {
    fail('pako@1.0.11: the MIT AND Zlib file-level split is not documented as expected');
  }

  const source = await readText(join(packageDirectory, 'lib/zlib/adler32.js'));
  const lines = normalizeText(source).split('\n');
  const start = lines.findIndex((line) => line === '// (C) 1995-2013 Jean-loup Gailly and Mark Adler');
  const end = lines.findIndex(
    (line, index) =>
      index >= start && line === '// 3. This notice may not be removed or altered from any source distribution.',
  );
  if (start < 0 || end < start) {
    fail('pako@1.0.11: cannot locate the complete Zlib notice in lib/zlib/adler32.js');
    return;
  }

  const extracted = lines
    .slice(start, end + 1)
    .map((line) => line.replace(/^\/\/ ?/, ''))
    .join('\n');
  const copyPath = join(THIRD_PARTY_DIR, 'npm/pako-1.0.11-Zlib-LICENSE.txt');
  if (!(await exists(copyPath))) {
    fail('pako@1.0.11: missing preserved Zlib license text');
    return;
  }
  const copy = await readText(copyPath);
  if (normalizeText(copy) !== normalizeText(extracted)) {
    fail('pako@1.0.11: preserved Zlib license text differs from the shipped source header');
  }
}

async function verifyTinyMce(packageDirectory) {
  if (TINYMCE_VERSION !== '8.8.2') {
    fail(`TinyMCE allow-list version is ${TINYMCE_VERSION}; expected 8.8.2`);
  }
  if (TINYMCE_VENDOR_ASSETS.includes(STOCK_EMOTICONS_DATABASE_ASSET)) {
    fail(`TinyMCE vendor allow-list must exclude ${STOCK_EMOTICONS_DATABASE_ASSET}`);
  }
  if (TINYMCE_VENDOR_ASSETS.includes(CUSTOM_EMOTICONS_DATABASE_ASSET)) {
    fail(`Generated emoji subset must not be treated as a byte-identical vendor asset`);
  }

  const [license, notices, core, theme] = await Promise.all([
    readText(join(packageDirectory, 'license.md')),
    readText(join(packageDirectory, 'notices.txt')),
    readText(join(packageDirectory, 'tinymce.min.js')),
    readText(join(packageDirectory, 'themes/silver/theme.min.js')),
  ]);

  if (!license.includes('GNU General Public License Version 2 or later')) {
    fail('tinymce@8.8.2: license.md does not select GNU GPL version 2 or later');
  }
  if (!license.includes('Copyright (c) 2025 Ephox Corporation DBA Tiny Technologies, Inc.')) {
    fail('tinymce@8.8.2: Tiny copyright notice is missing from license.md');
  }

  const noticeMarkers = [
    'version: 3.3.2',
    'license: MPL-2.0 OR Apache-2.0',
    'version: 1.25.0',
    'version: 1.9.0',
    'license: MIT',
  ];
  for (const marker of noticeMarkers) {
    if (!notices.includes(marker)) {
      fail(`tinymce@8.8.2: notices.txt is missing ${JSON.stringify(marker)}`);
    }
  }

  if (!core.includes('DOMPurify 3.4.11')) {
    fail('tinymce@8.8.2: expected stale DOMPurify 3.4.11 outer bundle banner is absent');
  }
  for (const [asset, text] of [
    ['tinymce.min.js', core],
    ['themes/silver/theme.min.js', theme],
  ]) {
    if (
      !text.includes('@license DOMPurify 3.4.12') ||
      !text.includes('version="3.4.12"') ||
      !text.includes('Mozilla Public License 2.0')
    ) {
      fail(`${asset}: executable DOMPurify 3.4.12/MPL markers are incomplete`);
    }
  }

  if (TINYMCE_VENDOR_ASSETS.some((asset) => asset.startsWith('plugins/codesample/'))) {
    fail('TinyMCE allow-list unexpectedly distributes codesample/PrismJS executable code');
  }
  const selectedJavaScript = (
    await Promise.all(
      TINYMCE_VENDOR_ASSETS.filter((asset) => asset.endsWith('.js')).map((asset) =>
        readText(join(packageDirectory, asset)),
      ),
    )
  ).join('\n');
  if (/PrismJS|Prism\.languages/.test(selectedJavaScript)) {
    fail('Selected TinyMCE JavaScript unexpectedly contains PrismJS executable code');
  }

  const selectedCss = (
    await Promise.all(
      TINYMCE_VENDOR_ASSETS.filter((asset) => asset.endsWith('.css')).map((asset) =>
        readText(join(packageDirectory, asset)),
      ),
    )
  ).join('\n');
  for (const marker of ['http://prismjs.com/', 'Dracula', 'Zeno Rocha', 'Albert Vallverdu']) {
    if (!selectedCss.includes(marker)) {
      fail(`Selected TinyMCE CSS is missing the embedded prism-themes attribution ${marker}`);
    }
  }
}

async function verifyEmbeddedLicenseTexts() {
  const checks = [
    {
      path: 'embedded/DOMPurify-3.4.12-MPL-2.0.txt',
      sha256: 'fab3dd6bdab226f1c08630b1dd917e11fcb4ec5e1e020e2c16f83a0a13863e85',
      markers: ['Mozilla Public License Version 2.0', '1. Definitions'],
    },
    {
      path: 'embedded/PrismJS-1.25.0-MIT.txt',
      sha256: '2b947f0901a7ffcf08a89957da9783c0e9c6e72cb6ce8e959f501ab5409e4d2b',
      markers: ['Copyright (c) 2012 Lea Verou', 'Permission is hereby granted, free of charge'],
    },
    {
      path: 'embedded/prism-themes-1.9.0-MIT.txt',
      sha256: 'e2264658d7deb2bfb574e3d6c9cff84d0e081a6887694d46c3c091e6e15a1119',
      markers: ['Copyright (c) 2015 PrismJS', 'Permission is hereby granted, free of charge'],
    },
    {
      path: 'embedded/emojilib-2.4.0-MIT.txt',
      sha256: 'da00c2955742e85d06f80a34f5142f96a6167df2d8762b2dc5a998c9f919a715',
      markers: ['Copyright (c) 2014 Mu-An Chiou', 'Permission is hereby granted, free of charge'],
    },
  ];

  for (const check of checks) {
    const path = join(THIRD_PARTY_DIR, check.path);
    if (!(await exists(path))) {
      fail(`Missing embedded-component license text ${relative(ROOT, path)}`);
      continue;
    }
    const bytes = await readFile(path);
    if (sha256(bytes) !== check.sha256) {
      fail(`${check.path}: SHA-256 differs from the pinned upstream license text`);
    }
    const text = bytes.toString('utf8');
    for (const marker of check.markers) {
      if (!text.includes(marker)) {
        fail(`${check.path}: missing ${JSON.stringify(marker)}`);
      }
    }
  }
}

async function verifyNotices(packages) {
  const notices = await readText(NOTICES_FILE);
  for (const { manifest } of packages) {
    const id = `${manifest.name}@${manifest.version}`;
    if (!notices.includes(`\`${id}\``)) {
      fail(`THIRD-PARTY-NOTICES.md has no exact runtime row for ${id}`);
    }
  }
  if (!notices.includes(EXPECTED_EMOTICONS_NOTICE_ROW)) {
    fail('THIRD-PARTY-NOTICES.md exact derived emoji component row differs');
  }

  const requiredStatements = [
    'vendor `notices.txt`: `3.3.2`',
    'outer `tinymce.min.js` bundle banner: `3.4.11`',
    'executable code and preserved internal `@license`: `3.4.12`',
    'This distribution selects **MPL-2.0**',
    'PrismJS code is not distributed',
    'published `dingbat-to-unicode@1.0.1` package contains no license file',
    'MIT AND Zlib',
    'Derived common emoji database (`emojis-common`)',
    '`emojilib@2.4.0`',
    'MIT (emojilib data) AND GPL-2.0-or-later',
    'Emoji data Copyright (c) 2014 Mu-An Chiou',
  ];
  for (const statement of requiredStatements) {
    if (!notices.includes(statement)) {
      fail(`THIRD-PARTY-NOTICES.md is missing the audit statement ${JSON.stringify(statement)}`);
    }
  }
}

const rootManifest = await readJson(join(ROOT, 'package.json'));
if (rootManifest.license !== 'GPL-2.0-or-later') {
  fail(`Root package license must be GPL-2.0-or-later, got ${rootManifest.license}`);
}
if (!equalObjects(rootManifest.dependencies, EXPECTED_DIRECT_RUNTIME)) {
  fail(
    `Direct runtime dependencies must be exactly ${JSON.stringify(EXPECTED_DIRECT_RUNTIME)}, ` +
      `got ${JSON.stringify(rootManifest.dependencies ?? {})}`,
  );
}

const rootLicense = await readText(join(ROOT, 'LICENSE'));
const rootLicenseSha256 = sha256(normalizeText(rootLicense));
if (rootLicenseSha256 !== GPL_V2_TEXT_SHA256) {
  fail(
    `Root LICENSE must match the pinned complete GPL version 2 text; ` +
      `expected ${GPL_V2_TEXT_SHA256}, got ${rootLicenseSha256}`,
  );
}

let packages = [];
try {
  packages = await collectRuntimeGraph(rootManifest);
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

const actualIds = packages
  .map(({ manifest }) => `${manifest.name}@${manifest.version}`)
  .sort((a, b) => a.localeCompare(b));
const expectedIds = [...EXPECTED_BY_ID.keys()].sort((a, b) => a.localeCompare(b));
for (const id of expectedIds.filter((id) => !actualIds.includes(id))) {
  fail(`Missing expected runtime package ${id}`);
}
for (const id of actualIds.filter((id) => !EXPECTED_BY_ID.has(id))) {
  fail(`Unexpected runtime package ${id}`);
}

for (const { directory, manifest } of packages) {
  const id = `${manifest.name}@${manifest.version}`;
  const expected = EXPECTED_BY_ID.get(id);
  if (!expected) {
    continue;
  }
  if (manifest.license !== expected.declaredLicense) {
    fail(
      `${id}: declared license changed from ${JSON.stringify(expected.declaredLicense)} ` +
        `to ${JSON.stringify(manifest.license)}`,
    );
  }

  let effectiveLicense = manifest.license;
  if (manifest.name === 'duck') {
    effectiveLicense = await verifyDuck(expected, directory);
  } else if (manifest.name === 'tinymce') {
    effectiveLicense = 'GPL-2.0-or-later';
    await verifyTinyMce(directory);
  } else if (manifest.name === 'jszip') {
    effectiveLicense = 'MIT';
  }
  if (manifest.name === 'pako') {
    await verifyPako(directory);
  }
  if (manifest.name === 'dingbat-to-unicode') {
    const candidates = ['LICENSE', 'LICENSE.md', 'LICENSE.txt', 'COPYING'];
    const present = [];
    for (const candidate of candidates) {
      if (await exists(join(directory, candidate))) {
        present.push(candidate);
      }
    }
    if (present.length > 0) {
      fail(
        `${id}: upstream packaging changed; review newly published license files ${present.join(', ')}`,
      );
    } else {
      warnings.push(
        `${id}: manifest declares BSD-2-Clause, but the published package has no license file ` +
          'or copyright notice; package author metadata names Michael Williamson',
      );
    }
  }

  expected.effectiveLicense = effectiveLicense;
  await verifyCopiedLicense(expected, directory);
}

await Promise.all([verifyEmbeddedLicenseTexts(), verifyNotices(packages)]);

const devDependencyNames = Object.keys(rootManifest.devDependencies ?? {});
const runtimeNames = new Set(packages.map(({ manifest }) => manifest.name));
for (const name of devDependencyNames) {
  if (runtimeNames.has(name)) {
    fail(`Development-only dependency ${name} leaked into the runtime closure`);
  }
}

const report = {
  ok: errors.length === 0,
  scope: {
    roots: EXPECTED_DIRECT_RUNTIME,
    traversal: 'dependencies plus installed optionalDependencies',
    excludedDevDependencies: devDependencyNames.sort(),
  },
  runtimePackages: packages
    .map(({ manifest }) => {
      const expected = EXPECTED_BY_ID.get(`${manifest.name}@${manifest.version}`);
      return {
        name: manifest.name,
        version: manifest.version,
        declaredLicense: manifest.license,
        effectiveLicense: expected?.effectiveLicense ?? null,
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name)),
  embeddedTinyMce: {
    DOMPurify: {
      noticesVersion: '3.3.2',
      outerBannerVersion: '3.4.11',
      executableVersion: '3.4.12',
      selectedLicense: 'MPL-2.0',
    },
    'prism-themes': {
      version: '1.9.0',
      license: 'MIT',
      shippedInSelectedCss: true,
    },
    PrismJS: {
      version: '1.25.0',
      license: 'MIT',
      shippedExecutableCode: false,
    },
    emojilib: {
      version: '2.4.0',
      license: 'MIT',
      copyright: 'Copyright (c) 2014 Mu-An Chiou',
      selectedEntries: 300,
      distributedAs: CUSTOM_EMOTICONS_DATABASE_ASSET,
    },
  },
  warnings,
  errors,
};

console.log(JSON.stringify(report, null, 2));
if (errors.length > 0) {
  process.exitCode = 1;
}
