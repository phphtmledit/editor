import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve } from 'node:path';
import mammoth from 'mammoth';

const projectRoot = resolve(import.meta.dirname, '..');
const fixturePath = resolve(projectRoot, 'tests', 'fixtures', 'mammoth-fixture.docx');
const expectedPath = resolve(projectRoot, 'tests', 'fixtures', 'mammoth-fixture.expected.html');
const reportsPath = resolve(projectRoot, 'reports');

const compactMarkup = (value) => value.replace(/>\s+</g, '><').trim();
const count = (html, tag) => (html.match(new RegExp(`<${tag}(?:\\s|>)`, 'g')) ?? []).length;

const [fixture, expected] = await Promise.all([
  readFile(fixturePath),
  readFile(expectedPath, 'utf8'),
]);
const result = await mammoth.convertToHtml({ buffer: fixture });
const matched = compactMarkup(result.value) === compactMarkup(expected);

const inventory = Object.fromEntries(
  ['h1', 'h2', 'h3', 'p', 'strong', 'em', 'u', 'code', 'a', 'ol', 'ul', 'li', 'table', 'thead', 'tbody', 'tr', 'th', 'td']
    .map((tag) => [tag, count(result.value, tag)]),
);
const expectedInventory = {
  h1: 1, h2: 3, h3: 2, p: 23, strong: 5, em: 2, u: 0, code: 0,
  a: 1, ol: 2, ul: 2, li: 10, table: 1, thead: 1, tbody: 1, tr: 5, th: 4, td: 14,
};
const inventoryMatched = Object.entries(expectedInventory)
  .every(([tag, expectedCount]) => inventory[tag] === expectedCount);
const messages = result.messages.map(({ type, message }) => ({ type, message }));

await mkdir(reportsPath, { recursive: true });
await Promise.all([
  writeFile(resolve(reportsPath, 'mammoth.actual.html'), `${result.value}\n`, 'utf8'),
  writeFile(resolve(reportsPath, 'mammoth-result.json'), `${JSON.stringify({
    matched,
    inventoryMatched,
    inventory,
    messages,
    fixtureBytes: fixture.byteLength,
    fixtureSha256: createHash('sha256').update(fixture).digest('hex'),
    expectedSha256: createHash('sha256').update(expected).digest('hex'),
    knownLosses: [
      'Direct underline is flattened without an explicit Mammoth style map.',
      'Direct Courier New runs remain plain text rather than semantic code.',
      'Nested ordered-list marker style and bullet glyph choices are flattened.',
      'Table presentation, heading colors/sizes, paragraph borders and indents are discarded.',
    ],
    notCovered: [
      'Vertical cell merge/rowspan',
      'Images and media',
      'Tracked changes and real comments/notes',
      'Macros/OLE and malformed or dangerous URLs',
      'Clipboard markup captured from a desktop Word installation',
    ],
  }, null, 2)}\n`, 'utf8'),
]);

console.log(JSON.stringify({ matched, inventoryMatched, inventory, messages }, null, 2));
if (!matched || !inventoryMatched || messages.length > 0) process.exitCode = 1;
