import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { isAbsolute, relative, resolve } from 'node:path';

export const EMOJILIB_LICENSE_RELATIVE_PATH =
  'third-party-licenses/embedded/emojilib-2.4.0-MIT.txt';
export const EMOJILIB_LICENSE_SHA256 =
  'da00c2955742e85d06f80a34f5142f96a6167df2d8762b2dc5a998c9f919a715';
export const EMOJILIB_LICENSE_MARKER = '## Embedded emoji data: emojilib 2.4.0 (MIT)';

const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const occurrenceCount = (text, marker) => text.split(marker).length - 1;

export const readEmojilibLicenseSection = async (projectRoot) => {
  const licensePath = resolve(projectRoot, EMOJILIB_LICENSE_RELATIVE_PATH);
  const source = await readFile(licensePath, 'utf8');
  const text = source.replace(/\r\n?/g, '\n');
  const digest = sha256(Buffer.from(text, 'utf8'));
  if (digest !== EMOJILIB_LICENSE_SHA256) {
    throw new Error(
      `emojilib 2.4.0 MIT text SHA-256 differs: expected ${EMOJILIB_LICENSE_SHA256}, ` +
        `got ${digest}`,
    );
  }
  if (!text.endsWith('\n') || text.endsWith('\n\n')) {
    throw new Error('emojilib 2.4.0 MIT text must have exactly one final newline');
  }
  return `${EMOJILIB_LICENSE_MARKER}\n\n${text}`;
};

export const appendEmojilibToCanonicalLicenses = async (projectRoot, outDirectory) => {
  const outputRoot = resolve(projectRoot, outDirectory);
  const fromProject = relative(projectRoot, outputRoot);
  if (fromProject.startsWith('..') || isAbsolute(fromProject)) {
    throw new Error(`Unsafe license output outside project: ${outputRoot}`);
  }

  const licensesPath = resolve(outputRoot, 'licenses.txt');
  const [generated, section] = await Promise.all([
    readFile(licensesPath, 'utf8'),
    readEmojilibLicenseSection(projectRoot),
  ]);
  const occurrences = occurrenceCount(generated, EMOJILIB_LICENSE_MARKER);
  if (occurrences > 1) {
    throw new Error(`${licensesPath} contains ${occurrences} emojilib sections`);
  }
  if (occurrences === 1) {
    if (!generated.endsWith(section)) {
      throw new Error(`${licensesPath} has a non-canonical emojilib section`);
    }
    return;
  }

  await writeFile(licensesPath, `${generated.trimEnd()}\n\n${section}`, 'utf8');
};
