import { access, readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import {
  EMOJILIB_LICENSE_MARKER,
  readEmojilibLicenseSection,
} from './embedded-licenses.mjs';
import {
  CUSTOM_EMOTICONS_DATABASE_ASSET,
  CUSTOM_EMOTICONS_DATABASE_ID,
  CUSTOM_EMOTICONS_MODIFIED_DATE,
  CUSTOM_ICON_ASSET,
  CUSTOM_ICON_MODIFIED_DATE,
  CUSTOM_ICON_NAMES,
  CUSTOM_ICON_PACK,
  STOCK_EMOTICONS_DATABASE_ASSET,
  TINYMCE_EXCLUDED_DARK_ASSETS,
  TINYMCE_VENDOR_ASSETS,
  TINYMCE_VERSION,
} from './tinymce-assets.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const failures = [];
const occurrenceCount = (text, marker) => text.split(marker).length - 1;

const requireMatch = (text, expression, message) => {
  if (!expression.test(text)) failures.push(message);
};

const [builtLicense, diagnosticLicense] = await Promise.all([
  readFile(resolve(projectRoot, 'dist', 'licenses.txt'), 'utf8'),
  readFile(resolve(projectRoot, 'dist-e0', 'licenses.txt'), 'utf8'),
]);
const expectedEmojilibLicenseSection = await readEmojilibLicenseSection(projectRoot);
for (const [name, text] of [
  ['product', builtLicense],
  ['diagnostic', diagnosticLicense],
]) {
  const occurrences = occurrenceCount(text, EMOJILIB_LICENSE_MARKER);
  if (occurrences !== 1) {
    failures.push(`${name} licenses.txt must contain one emojilib section, got ${occurrences}`);
  }
  if (!text.endsWith(expectedEmojilibLicenseSection)) {
    failures.push(`${name} licenses.txt does not end with the exact emojilib 2.4.0 MIT text`);
  }
}
const productCodeMirrorRoots = [
  ['@codemirror/commands', '6.10.4'],
  ['@codemirror/lang-html', '6.4.12'],
  ['@codemirror/language', '6.12.4'],
  ['@codemirror/search', '6.7.1'],
  ['@codemirror/state', '6.7.1'],
  ['@codemirror/view', '6.43.8'],
];
for (const [name, version] of productCodeMirrorRoots) {
  const marker = `## ${name} - ${version} (MIT)`;
  if (!builtLicense.includes(marker)) {
    failures.push(`${name}@${version} license is absent from product dist/licenses.txt`);
  }
}
requireMatch(
  builtLicense,
  /^## mammoth - 1\.12\.1 \(BSD-2-Clause\)$/m,
  'Mammoth license is absent from product dist/licenses.txt',
);
requireMatch(
  diagnosticLicense,
  /^## mammoth - 1\.12\.1 \(BSD-2-Clause\)$/m,
  'Mammoth license is absent from diagnostic dist-e0/licenses.txt',
);

const builtJsPaths = (await readdir(resolve(projectRoot, 'dist', 'assets')))
  .filter((file) => file.endsWith('.js'));
const mainJsPath = builtJsPaths.find((file) => file.startsWith('index-'));
if (!mainJsPath) failures.push('Built application JS was not found');
for (const jsPath of builtJsPaths) {
  const builtJs = await readFile(resolve(projectRoot, 'dist', 'assets', jsPath), 'utf8');
  requireMatch(
    builtJs,
    /@license GPL-2\.0-or-later/,
    `Project GPL legal comment is missing from ${jsPath}`,
  );
  requireMatch(
    builtJs,
    /Third-party notices: \/licenses\.txt/,
    `Project bundle has no canonical notices URL: ${jsPath}`,
  );
}

for (const asset of TINYMCE_VENDOR_ASSETS) {
  const [source, built] = await Promise.all([
    readFile(resolve(projectRoot, 'node_modules', 'tinymce', asset)),
    readFile(resolve(projectRoot, 'dist', 'tinymce', asset)),
  ]);
  const sourceHash = createHash('sha256').update(source).digest('hex');
  const builtHash = createHash('sha256').update(built).digest('hex');
  if (sourceHash !== builtHash) failures.push(`TinyMCE asset changed during build: ${asset}`);
}
const includedDarkAssets = TINYMCE_EXCLUDED_DARK_ASSETS.filter((asset) =>
  TINYMCE_VENDOR_ASSETS.includes(asset));
if (includedDarkAssets.length > 0) {
  failures.push(`Dark TinyMCE assets remain in the vendor allow-list: ${includedDarkAssets.join(', ')}`);
}
for (const root of ['public', 'dist', 'dist-e0']) {
  for (const asset of TINYMCE_EXCLUDED_DARK_ASSETS) {
    try {
      await access(resolve(projectRoot, root, 'tinymce', asset));
      failures.push(`${root} contains excluded dark TinyMCE asset: ${asset}`);
    } catch {
      // Expected: the MVP distributes only the light TinyMCE skin.
    }
  }
}

const [publicCustomIcons, builtCustomIcons] = await Promise.all([
  readFile(resolve(projectRoot, 'public', 'tinymce', CUSTOM_ICON_ASSET)),
  readFile(resolve(projectRoot, 'dist', 'tinymce', CUSTOM_ICON_ASSET)),
]);
if (
  createHash('sha256').update(publicCustomIcons).digest('hex') !==
  createHash('sha256').update(builtCustomIcons).digest('hex')
) {
  failures.push(`Generated custom icon asset changed during build: ${CUSTOM_ICON_ASSET}`);
}
const customIconText = publicCustomIcons.toString('utf8');
const customIconCopyright =
  'Copyright (c) 2025 Ephox Corporation DBA Tiny Technologies, Inc.';
const customIconLicense =
  '@license GPL-2.0-or-later — full text in tinymce/license.md';
const customIconDerivation =
  `Derived from the TinyMCE ${TINYMCE_VERSION} default icon pack.`;
const customIconModification =
  `Modified by the phphtmledit project on ${CUSTOM_ICON_MODIFIED_DATE}: ` +
  `selected a ${CUSTOM_ICON_NAMES.length}-icon\n` +
  ' * subset and changed the pack registration name. Icon artwork is unaltered.';
const expectedCustomIconBanner =
  `/*!\n` +
  ` * ${customIconCopyright}\n` +
  ` * ${customIconLicense}\n` +
  ` *\n` +
  ` * ${customIconDerivation}\n` +
  ` * ${customIconModification}\n` +
  ` */`;

requireMatch(
  customIconText,
  /Copyright \(c\) 2025 Ephox Corporation DBA Tiny Technologies, Inc\./,
  'Custom icon TinyMCE copyright notice is missing',
);
requireMatch(
  customIconText,
  /@license GPL-2\.0-or-later — full text in tinymce\/license\.md/,
  'Custom icon GPL legal comment is missing',
);
if (!customIconText.includes(customIconModification)) {
  failures.push('Custom icon exact dated modification notice is missing');
}
if (!customIconText.startsWith(`${expectedCustomIconBanner}\n`)) {
  failures.push('Custom icon legal banner wording or notice order differs');
}
requireMatch(
  customIconText,
  new RegExp(`IconManager\\.add\\(${JSON.stringify(CUSTOM_ICON_PACK)}`),
  'Custom icon pack registration is missing',
);
const customIconEntryCount = (customIconText.match(/<svg\b/g) ?? []).length;
if (customIconEntryCount !== CUSTOM_ICON_NAMES.length) {
  failures.push(
    `Custom icon count differs: expected ${CUSTOM_ICON_NAMES.length}, got ${customIconEntryCount}`,
  );
}

const customEmoticonsPaths = [
  resolve(projectRoot, 'public', 'tinymce', CUSTOM_EMOTICONS_DATABASE_ASSET),
  resolve(projectRoot, 'dist', 'tinymce', CUSTOM_EMOTICONS_DATABASE_ASSET),
  resolve(projectRoot, 'dist-e0', 'tinymce', CUSTOM_EMOTICONS_DATABASE_ASSET),
];
const customEmoticonsCopies = await Promise.all(customEmoticonsPaths.map((path) => readFile(path)));
const customEmoticonsHashes = customEmoticonsCopies.map((bytes) =>
  createHash('sha256').update(bytes).digest('hex'));
if (new Set(customEmoticonsHashes).size !== 1) {
  failures.push(`Generated emoji asset changed between public/product/diagnostic builds`);
}
const expectedCustomEmoticonsHash =
  'ae44bba7002ff59b2ffcd17b96bcd7b51c39dbbe4a07c767b1bab5c9201f4b19';
if (customEmoticonsHashes[0] !== expectedCustomEmoticonsHash) {
  failures.push(`Generated emoji asset SHA-256 differs: ${customEmoticonsHashes[0]}`);
}

if (TINYMCE_VENDOR_ASSETS.includes(STOCK_EMOTICONS_DATABASE_ASSET)) {
  failures.push(`Stock emoji database remains in the TinyMCE vendor allow-list`);
}
for (const root of ['public', 'dist', 'dist-e0']) {
  try {
    await access(resolve(projectRoot, root, 'tinymce', STOCK_EMOTICONS_DATABASE_ASSET));
    failures.push(`${root} contains forbidden stock emoji database`);
  } catch {
    // Expected: only the generated subset may be distributed.
  }
}

const customEmoticonsText = customEmoticonsCopies[0].toString('utf8');
const expectedCustomEmoticonsBanner = `/*!
 * Emoji data:
 * Copyright (c) 2014 Mu-An Chiou
 * @license MIT — full text in /licenses.txt
 *
 * TinyMCE Resource registration wrapper:
 * Copyright (c) 2025 Ephox Corporation DBA Tiny Technologies, Inc.
 * @license GPL-2.0-or-later — full text in /tinymce/license.md
 *
 * Modified by the phphtmledit project on ${CUSTOM_EMOTICONS_MODIFIED_DATE}: selected a deterministic
 * 300-entry subset from the TinyMCE ${TINYMCE_VERSION} emoji database (source data:
 * emojilib 2.4.0). Names, keywords, characters, categories and Fitzpatrick
 * metadata are unaltered.
 */`;
if (!customEmoticonsText.startsWith(`${expectedCustomEmoticonsBanner}\n`)) {
  failures.push('Generated emoji legal banner wording or notice order differs');
}

let registeredEmoticons;
runInNewContext(
  customEmoticonsText,
  {
    window: {
      tinymce: {
        Resource: {
          add: (id, database) => {
            if (registeredEmoticons) throw new Error('Generated emoji file registers twice');
            registeredEmoticons = { id, database };
          },
        },
      },
    },
  },
  { filename: CUSTOM_EMOTICONS_DATABASE_ASSET, timeout: 1_000 },
);
if (registeredEmoticons?.id !== CUSTOM_EMOTICONS_DATABASE_ID) {
  failures.push(`Generated emoji resource id differs: ${registeredEmoticons?.id ?? '<none>'}`);
}
const registeredEmoticonEntries = Object.values(registeredEmoticons?.database ?? {});
if (registeredEmoticonEntries.length !== 300) {
  failures.push(`Generated emoji count differs: ${registeredEmoticonEntries.length}`);
}
const expectedEmoticonCategoryCounts = {
  people: 95,
  animals_and_nature: 40,
  food_and_drink: 35,
  activity: 25,
  travel_and_places: 30,
  objects: 35,
  symbols: 25,
  flags: 15,
};
for (const [category, expected] of Object.entries(expectedEmoticonCategoryCounts)) {
  const actual = registeredEmoticonEntries.filter((entry) => entry.category === category).length;
  if (actual !== expected) {
    failures.push(`Generated emoji category ${category} differs: ${actual}/${expected}`);
  }
}

const tinyCore = await readFile(resolve(projectRoot, 'dist', 'tinymce', 'tinymce.min.js'), 'utf8');
requireMatch(tinyCore, new RegExp(`TinyMCE version ${TINYMCE_VERSION.replaceAll('.', '\\.')}`), 'TinyMCE version header is missing');
requireMatch(tinyCore, /@license DOMPurify 3\.4\.12/, 'Embedded DOMPurify 3.4.12 legal comment is missing');
requireMatch(tinyCore, /Mozilla Public License 2\.0/, 'Embedded DOMPurify MPL-2.0 choice is missing');

const skinCss = await readFile(resolve(projectRoot, 'dist', 'tinymce', 'skins', 'ui', 'oxide', 'content.min.css'), 'utf8');
requireMatch(skinCss, /PrismJS|prismjs/i, 'PrismJS notice is missing from TinyMCE skin CSS');

if (failures.length > 0) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `Legal comments, product CodeMirror and lazy Mammoth notices, diagnostic Mammoth notice, ` +
      `${TINYMCE_VENDOR_ASSETS.length} byte-identical TinyMCE assets, and the ` +
      `${CUSTOM_ICON_NAMES.length}-icon custom pack, 300-entry emoji subset, and ` +
      `canonical emojilib MIT text verified.`,
  );
}
