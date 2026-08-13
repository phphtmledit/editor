/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { convertDocx } from './mammoth-runtime';

const docxFixtureUrl = new URL('../../tests/fixtures/mammoth-fixture.docx', import.meta.url);
const docxExpectedUrl = new URL('../../tests/fixtures/mammoth-fixture.expected.html', import.meta.url);

const compactMarkup = (value: string): string => value.replace(/>\s+</g, '><').trim();

export const runFixtureSmoke = async () => {
  const [fixtureResponse, expectedResponse] = await Promise.all([
    fetch(docxFixtureUrl),
    fetch(docxExpectedUrl),
  ]);

  if (!fixtureResponse.ok || !expectedResponse.ok) {
    throw new Error(`Fixture request failed (${fixtureResponse.status}/${expectedResponse.status})`);
  }

  const [arrayBuffer, expected] = await Promise.all([
    fixtureResponse.arrayBuffer(),
    expectedResponse.text(),
  ]);
  const result = await convertDocx(arrayBuffer);

  return {
    matched: compactMarkup(result.value) === compactMarkup(expected),
    messages: result.messages.map((message: { type: string; message: string }) => ({
      type: message.type,
      message: message.message,
    })),
    html: result.value,
  };
};
