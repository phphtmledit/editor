import { copyFile, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { brotliCompressSync, constants, gzipSync } from 'node:zlib';
import {
  CUSTOM_EMOTICONS_DATABASE_ASSET,
  CUSTOM_EMOTICONS_DATABASE_ID,
  CUSTOM_EMOTICONS_MODIFIED_DATE,
  CUSTOM_ICON_ASSET,
  CUSTOM_ICON_MODIFIED_DATE,
  CUSTOM_ICON_NAMES,
  CUSTOM_ICON_PACK,
  STOCK_EMOTICONS_DATABASE_ASSET,
  TINYMCE_VENDOR_ASSETS,
  TINYMCE_VERSION,
} from './tinymce-assets.mjs';

const projectRoot = resolve(import.meta.dirname, '..');
const sourceRoot = resolve(projectRoot, 'node_modules', 'tinymce');
const targetRoot = resolve(projectRoot, 'public', 'tinymce');

const EMOTICONS_SOURCE_SHA256 =
  '66f71a7fc7094165772664ff37a327c75090fbc646186b7e89c6e39d0676cdf1';
const EMOTICONS_INVENTORY_SHA256 =
  '1f9d92018d716f1dcf03f9d506c1c4acc9b81737ccee9a0099e4b63288803ccc';
const EMOTICONS_SUBSET_SHA256 =
  'ae44bba7002ff59b2ffcd17b96bcd7b51c39dbbe4a07c767b1bab5c9201f4b19';
const EMOTICONS_SOURCE_COUNT = 1570;
const EMOTICONS_CATEGORY_QUOTAS = Object.freeze({
  people: 95,
  animals_and_nature: 40,
  food_and_drink: 35,
  activity: 25,
  travel_and_places: 30,
  objects: 35,
  symbols: 25,
  flags: 15,
});
const EMOTICONS_SOURCE_CATEGORY_COUNTS = Object.freeze({
  people: 346,
  animals_and_nature: 177,
  food_and_drink: 105,
  activity: 95,
  travel_and_places: 119,
  objects: 202,
  symbols: 274,
  flags: 252,
});

// Pinned common entries come first. Only a list shorter than its fixed quota
// is completed, in the exact TinyMCE 8.8.2 database order.
const EMOTICONS_PRIORITY_BY_CATEGORY = Object.freeze({
  people: [
    'grinning', 'joy', 'rofl', 'smile', 'laughing', 'wink', 'blush', 'relaxed',
    'heart_eyes', 'smiling_face_with_three_hearts', 'kissing_heart',
    'stuck_out_tongue_winking_eye', 'sunglasses', 'star_struck', 'hugs', 'smirk',
    'neutral_face', 'unamused', 'roll_eyes', 'thinking', 'hand_over_mouth',
    'shushing', 'symbols_over_mouth', 'exploding_head', 'flushed', 'disappointed',
    'worried', 'angry', 'rage', 'confused', 'pleading', 'open_mouth', 'scream',
    'cry', 'sob', 'sleeping', 'poop', 'skull', 'ghost', 'alien', 'robot', '+1',
    '-1', 'clap', 'wave', 'ok_hand', 'raised_hand', 'muscle', 'pray', 'handshake',
    'point_up', 'point_down', 'point_left', 'point_right', 'v', 'crossed_fingers',
    'eyes', 'brain', 'baby', 'boy', 'girl', 'adult', 'man', 'woman', 'older_man',
    'older_woman', 'raised_hands', 'fist', 'open_hands', 'writing_hand', 'ear',
    'nose', 'eye', 'busts_in_silhouette', 'speaking_head',
  ],
  animals_and_nature: [
    'dog', 'cat', 'mouse', 'hamster', 'rabbit', 'fox_face', 'bear', 'panda_face',
    'koala', 'tiger', 'lion', 'cow', 'pig', 'frog', 'monkey_face', 'see_no_evil',
    'hear_no_evil', 'speak_no_evil', 'chicken', 'penguin', 'bird', 'eagle', 'duck',
    'owl', 'unicorn', 'honeybee', 'butterfly', 'bug', 'snail', 'beetle', 'ant',
    'spider', 'turtle', 'snake', 'lizard', 'octopus', 'fish', 'whale', 'dolphin',
    'elephant',
  ],
  food_and_drink: [
    'green_apple', 'apple', 'tangerine', 'lemon', 'banana', 'watermelon', 'grapes',
    'strawberry', 'cherries', 'peach', 'pineapple', 'avocado', 'tomato', 'eggplant',
    'carrot', 'corn', 'bread', 'croissant', 'cheese', 'egg', 'bacon', 'hamburger',
    'fries', 'pizza', 'hotdog', 'taco', 'burrito', 'ramen', 'sushi', 'rice', 'cake',
    'birthday', 'coffee', 'beer', 'wine_glass',
  ],
  activity: [
    'soccer', 'basketball', 'football', 'baseball', 'tennis', 'volleyball', 'golf',
    'ping_pong', 'badminton', 'ice_hockey', 'ski', 'snowboarder', 'swimming_woman',
    'surfing_man', 'rowing_woman', 'biking_man', 'mountain_biking_man', 'trophy',
    'medal_sports', 'dart', 'bowling', 'video_game', 'game_die', 'boxing_glove',
    'martial_arts_uniform',
  ],
  travel_and_places: [
    'red_car', 'taxi', 'bus', 'ambulance', 'fire_engine', 'truck', 'tractor',
    'motorcycle', 'bike', 'train', 'bullettrain_side', 'metro', 'station', 'airplane',
    'helicopter', 'rocket', 'flying_saucer', 'ship', 'sailboat', 'speedboat',
    'traffic_light', 'construction', 'fuelpump', 'house', 'house_with_garden',
    'office', 'hospital', 'school', 'hotel', 'church',
  ],
  objects: [
    'watch', 'iphone', 'calling', 'computer', 'keyboard', 'printer', 'computer_mouse',
    'joystick', 'floppy_disk', 'cd', 'dvd', 'camera', 'video_camera', 'movie_camera',
    'phone', 'tv', 'radio', 'studio_microphone', 'compass', 'alarm_clock', 'hourglass',
    'bulb', 'flashlight', 'battery', 'electric_plug', 'moneybag', 'credit_card', 'gem',
    'wrench', 'hammer', 'key', 'lock', 'unlock', 'memo', 'gift',
  ],
  symbols: [
    'heart', 'orange_heart', 'yellow_heart', 'green_heart', 'blue_heart',
    'purple_heart', 'black_heart', 'broken_heart', 'two_hearts', 'sparkling_heart',
    'cupid', 'gift_heart', 'heavy_check_mark', 'white_check_mark', 'x', 'warning',
    'question', 'exclamation', 'bangbang', 'interrobang', 'o', 'no_entry',
    'no_entry_sign', 'recycle', 'infinity',
  ],
  flags: [
    'us', 'uk', 'canada', 'fr', 'de', 'es', 'it', 'jp', 'cn', 'ru', 'ukraine',
    'india', 'brazil', 'australia', 'united_nations',
  ],
});

const customEmoticonsBanner = `/*!
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

const assertInside = (parent, child) => {
  const pathFromParent = relative(parent, child);
  if (pathFromParent.startsWith('..') || isAbsolute(pathFromParent)) {
    throw new Error(`Unsafe path outside ${parent}: ${child}`);
  }
};

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const compressedSizes = (bytes) => ({
  raw: bytes.byteLength,
  gzip9: gzipSync(bytes, { level: 9 }).byteLength,
  brotli11: brotliCompressSync(bytes, {
    params: { [constants.BROTLI_PARAM_QUALITY]: 11 },
  }).byteLength,
});

assertInside(projectRoot, sourceRoot);
assertInside(projectRoot, targetRoot);

const packageJson = JSON.parse(await readFile(join(sourceRoot, 'package.json'), 'utf8'));
if (packageJson.version !== TINYMCE_VERSION) {
  throw new Error(`Expected TinyMCE ${TINYMCE_VERSION}, found ${packageJson.version}`);
}
if (TINYMCE_VENDOR_ASSETS.includes(STOCK_EMOTICONS_DATABASE_ASSET)) {
  throw new Error(`Stock emoji database must not be copied: ${STOCK_EMOTICONS_DATABASE_ASSET}`);
}

await stat(sourceRoot);
await rm(targetRoot, { recursive: true, force: true });

const manifest = [];
for (const asset of TINYMCE_VENDOR_ASSETS) {
  const source = resolve(sourceRoot, asset);
  const target = resolve(targetRoot, asset);
  assertInside(sourceRoot, source);
  assertInside(targetRoot, target);
  await stat(source);
  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);

  const [sourceBytes, targetBytes] = await Promise.all([readFile(source), readFile(target)]);
  const sourceHash = createHash('sha256').update(sourceBytes).digest('hex');
  const targetHash = createHash('sha256').update(targetBytes).digest('hex');
  if (sourceHash !== targetHash) throw new Error(`Copy verification failed for ${asset}`);
  manifest.push({
    path: asset,
    kind: 'vendor-byte-identical',
    bytes: targetBytes.byteLength,
    sha256: targetHash,
  });
}

let defaultIconPack;
runInNewContext(
  await readFile(resolve(sourceRoot, 'icons/default/icons.js'), 'utf8'),
  {
    tinymce: {
      IconManager: {
        add: (name, iconPack) => {
          if (name === 'default') defaultIconPack = iconPack;
        },
      },
    },
  },
  { filename: 'tinymce/icons/default/icons.js' },
);
if (!defaultIconPack?.icons) throw new Error('Could not read the TinyMCE default icon pack');

const selectedIcons = {};
for (const name of CUSTOM_ICON_NAMES) {
  const svg = defaultIconPack.icons[name];
  if (typeof svg !== 'string') throw new Error(`TinyMCE default icon is missing: ${name}`);
  selectedIcons[name] = svg;
}
const customIconBanner =
  `/*!\n` +
  ` * Copyright (c) 2025 Ephox Corporation DBA Tiny Technologies, Inc.\n` +
  ` * @license GPL-2.0-or-later — full text in tinymce/license.md\n` +
  ` *\n` +
  ` * Derived from the TinyMCE ${TINYMCE_VERSION} default icon pack.\n` +
  ` * Modified by the phphtmledit project on ${CUSTOM_ICON_MODIFIED_DATE}: selected a ${CUSTOM_ICON_NAMES.length}-icon\n` +
  ` * subset and changed the pack registration name. Icon artwork is unaltered.\n` +
  ` */`;
const customIconSource =
  `${customIconBanner}\n` +
  `tinymce.IconManager.add(${JSON.stringify(CUSTOM_ICON_PACK)},` +
  `${JSON.stringify({ icons: selectedIcons })});\n`;
const customTarget = resolve(targetRoot, CUSTOM_ICON_ASSET);
assertInside(targetRoot, customTarget);
await mkdir(dirname(customTarget), { recursive: true });
await writeFile(customTarget, customIconSource, 'utf8');
const customBytes = await readFile(customTarget);
manifest.push({
  path: CUSTOM_ICON_ASSET,
  kind: 'project-generated-from-tinymce',
  icons: CUSTOM_ICON_NAMES.length,
  bytes: customBytes.byteLength,
  sha256: createHash('sha256').update(customBytes).digest('hex'),
});

const stockEmoticonsPath = resolve(sourceRoot, STOCK_EMOTICONS_DATABASE_ASSET);
assertInside(sourceRoot, stockEmoticonsPath);
const stockEmoticonsBytes = await readFile(stockEmoticonsPath);
const stockEmoticonsHash = sha256(stockEmoticonsBytes);
if (stockEmoticonsHash !== EMOTICONS_SOURCE_SHA256) {
  throw new Error(
    `Unexpected TinyMCE emoji source SHA-256: expected ${EMOTICONS_SOURCE_SHA256}, ` +
      `got ${stockEmoticonsHash}`,
  );
}

let capturedEmoticons;
runInNewContext(
  stockEmoticonsBytes.toString('utf8'),
  {
    window: {
      tinymce: {
        Resource: {
          add: (id, database) => {
            if (capturedEmoticons) throw new Error('Emoji source registered more than one resource');
            capturedEmoticons = { id, database };
          },
        },
      },
    },
  },
  { filename: `tinymce/${STOCK_EMOTICONS_DATABASE_ASSET}`, timeout: 1_000 },
);
if (!capturedEmoticons || capturedEmoticons.id !== CUSTOM_EMOTICONS_DATABASE_ID) {
  throw new Error(`Unexpected emoji resource id: ${capturedEmoticons?.id ?? '<none>'}`);
}

const sourceEmoticonEntries = Object.entries(capturedEmoticons.database);
if (sourceEmoticonEntries.length !== EMOTICONS_SOURCE_COUNT) {
  throw new Error(
    `Unexpected TinyMCE emoji count: expected ${EMOTICONS_SOURCE_COUNT}, ` +
      `got ${sourceEmoticonEntries.length}`,
  );
}
for (const [name, entry] of sourceEmoticonEntries) {
  if (
    JSON.stringify(Object.keys(entry)) !==
    JSON.stringify(['keywords', 'char', 'fitzpatrick_scale', 'category'])
  ) {
    throw new Error(`Unexpected emoji record fields or field order: ${name}`);
  }
  if (
    !Array.isArray(entry.keywords) ||
    !entry.keywords.every((keyword) => typeof keyword === 'string') ||
    typeof entry.char !== 'string' ||
    entry.char.length === 0 ||
    typeof entry.fitzpatrick_scale !== 'boolean' ||
    !Object.hasOwn(EMOTICONS_SOURCE_CATEGORY_COUNTS, entry.category)
  ) {
    throw new Error(`Invalid emoji record: ${name}`);
  }
}

const actualSourceCategoryCounts = Object.fromEntries(
  Object.keys(EMOTICONS_SOURCE_CATEGORY_COUNTS).map((category) => [
    category,
    sourceEmoticonEntries.filter(([, entry]) => entry.category === category).length,
  ]),
);
if (
  JSON.stringify(actualSourceCategoryCounts) !==
  JSON.stringify(EMOTICONS_SOURCE_CATEGORY_COUNTS)
) {
  throw new Error(
    `Unexpected TinyMCE emoji category counts: ${JSON.stringify(actualSourceCategoryCounts)}`,
  );
}

const selectedEmoticons = {};
const selectedEmoticonNames = [];
const selectedEmoticonSet = new Set();
for (const [category, quota] of Object.entries(EMOTICONS_CATEGORY_QUOTAS)) {
  const priority = EMOTICONS_PRIORITY_BY_CATEGORY[category];
  if (!Array.isArray(priority) || new Set(priority).size !== priority.length) {
    throw new Error(`Missing or duplicate emoji priority key in ${category}`);
  }
  if (priority.length > quota) {
    throw new Error(`${category} emoji priority list exceeds quota ${quota}`);
  }

  const categoryNames = [...priority];
  for (const name of priority) {
    const entry = capturedEmoticons.database[name];
    if (!entry) throw new Error(`Missing required TinyMCE emoji: ${name}`);
    if (entry.category !== category) {
      throw new Error(`TinyMCE emoji ${name} is ${entry.category}, expected ${category}`);
    }
  }
  for (const [name, entry] of sourceEmoticonEntries) {
    if (categoryNames.length === quota) break;
    if (entry.category === category && !categoryNames.includes(name)) categoryNames.push(name);
  }
  if (categoryNames.length !== quota) {
    throw new Error(`${category} emoji selection yielded ${categoryNames.length}/${quota}`);
  }

  for (const name of categoryNames) {
    if (selectedEmoticonSet.has(name)) throw new Error(`Duplicate selected emoji: ${name}`);
    selectedEmoticonSet.add(name);
    selectedEmoticonNames.push(name);
    selectedEmoticons[name] = capturedEmoticons.database[name];
  }
}
if (selectedEmoticonNames.length !== 300 || selectedEmoticonSet.size !== 300) {
  throw new Error(`Expected exactly 300 unique emojis, got ${selectedEmoticonSet.size}`);
}
for (const name of selectedEmoticonNames) {
  if (
    JSON.stringify(selectedEmoticons[name]) !==
    JSON.stringify(capturedEmoticons.database[name])
  ) {
    throw new Error(`Selected emoji record changed: ${name}`);
  }
}

const emoticonsInventoryHash = sha256(
  Buffer.from(`${selectedEmoticonNames.join('\n')}\n`, 'utf8'),
);
if (emoticonsInventoryHash !== EMOTICONS_INVENTORY_SHA256) {
  throw new Error(
    `Unexpected emoji inventory SHA-256: expected ${EMOTICONS_INVENTORY_SHA256}, ` +
      `got ${emoticonsInventoryHash}`,
  );
}
const customEmoticonsSource =
  `${customEmoticonsBanner}\n` +
  `window.tinymce.Resource.add(${JSON.stringify(CUSTOM_EMOTICONS_DATABASE_ID)},` +
  `${JSON.stringify(selectedEmoticons)});\n`;
const customEmoticonsBytes = Buffer.from(customEmoticonsSource, 'utf8');
const customEmoticonsHash = sha256(customEmoticonsBytes);
if (customEmoticonsHash !== EMOTICONS_SUBSET_SHA256) {
  throw new Error(
    `Unexpected generated emoji SHA-256: expected ${EMOTICONS_SUBSET_SHA256}, ` +
      `got ${customEmoticonsHash}`,
  );
}

const customEmoticonsTarget = resolve(targetRoot, CUSTOM_EMOTICONS_DATABASE_ASSET);
assertInside(targetRoot, customEmoticonsTarget);
await mkdir(dirname(customEmoticonsTarget), { recursive: true });
await writeFile(customEmoticonsTarget, customEmoticonsBytes);
manifest.push({
  path: CUSTOM_EMOTICONS_DATABASE_ASSET,
  kind: 'project-generated-from-tinymce-emojilib',
  entries: selectedEmoticonNames.length,
  inventorySha256: emoticonsInventoryHash,
  bytes: customEmoticonsBytes.byteLength,
  sha256: customEmoticonsHash,
});

const stockEmoticonsSizes = compressedSizes(stockEmoticonsBytes);
const customEmoticonsSizes = compressedSizes(customEmoticonsBytes);
const emoticonsReport = {
  tinymceVersion: TINYMCE_VERSION,
  source: {
    path: `node_modules/tinymce/${STOCK_EMOTICONS_DATABASE_ASSET}`,
    resourceId: capturedEmoticons.id,
    entries: sourceEmoticonEntries.length,
    categoryCounts: actualSourceCategoryCounts,
    fitzpatrickScaleEntries: sourceEmoticonEntries.filter(([, entry]) =>
      entry.fitzpatrick_scale).length,
    sha256: stockEmoticonsHash,
    ...stockEmoticonsSizes,
  },
  subset: {
    path: `public/tinymce/${CUSTOM_EMOTICONS_DATABASE_ASSET}`,
    resourceId: CUSTOM_EMOTICONS_DATABASE_ID,
    entries: selectedEmoticonNames.length,
    categoryQuotas: EMOTICONS_CATEGORY_QUOTAS,
    fitzpatrickScaleEntries: selectedEmoticonNames.filter((name) =>
      selectedEmoticons[name].fitzpatrick_scale).length,
    inventorySha256: emoticonsInventoryHash,
    sha256: customEmoticonsHash,
    ...customEmoticonsSizes,
  },
  coldSavings: {
    raw: stockEmoticonsSizes.raw - customEmoticonsSizes.raw,
    gzip9: stockEmoticonsSizes.gzip9 - customEmoticonsSizes.gzip9,
    brotli11: stockEmoticonsSizes.brotli11 - customEmoticonsSizes.brotli11,
  },
};

await mkdir(resolve(projectRoot, 'reports'), { recursive: true });
await Promise.all([
  writeFile(
    resolve(projectRoot, 'reports', 'tinymce-assets.json'),
    `${JSON.stringify({ version: TINYMCE_VERSION, assets: manifest }, null, 2)}\n`,
    'utf8',
  ),
  writeFile(
    resolve(projectRoot, 'reports', 'emoticons-subset.json'),
    `${JSON.stringify(emoticonsReport, null, 2)}\n`,
    'utf8',
  ),
]);

console.log(
  `Copied and verified ${TINYMCE_VENDOR_ASSETS.length} TinyMCE ${TINYMCE_VERSION} files; ` +
    `generated ${CUSTOM_ICON_PACK} with ${CUSTOM_ICON_NAMES.length} icons and ` +
    `${selectedEmoticonNames.length} common emojis.`,
);
