/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NOTICES_URL,
  DEFAULT_SOURCE_URL,
  readAppConfig,
} from '../../src/config';

describe('public legal-link configuration', () => {
  it('uses the exact public repository and delivered-notices fallbacks', () => {
    const config = readAppConfig('', {});

    expect(config.legalLinks).toEqual({
      sourceUrl: 'https://github.com/phphtmledit/editor',
      noticesUrl: '/licenses.txt',
    });
    expect(DEFAULT_SOURCE_URL).toBe('https://github.com/phphtmledit/editor');
    expect(DEFAULT_NOTICES_URL).toBe('/licenses.txt');
  });

  it('preserves safe Vite overrides as the link targets', () => {
    const config = readAppConfig('?theme=dark', {
      VITE_SOURCE_URL: 'https://code.example.test/phphtmledit/editor?ref=public',
      VITE_NOTICES_URL: '/legal/notices.txt?v=2',
    });

    expect(config.legalLinks).toEqual({
      sourceUrl: 'https://code.example.test/phphtmledit/editor?ref=public',
      noticesUrl: '/legal/notices.txt?v=2',
    });
  });

  it.each([
    [{ VITE_SOURCE_URL: '' }, DEFAULT_SOURCE_URL, DEFAULT_NOTICES_URL],
    [{ VITE_SOURCE_URL: 'javascript:alert(1)' }, DEFAULT_SOURCE_URL, DEFAULT_NOTICES_URL],
    [{ VITE_NOTICES_URL: 'data:text/plain,notices' }, DEFAULT_SOURCE_URL, DEFAULT_NOTICES_URL],
    [{ VITE_SOURCE_URL: 'https://%' }, DEFAULT_SOURCE_URL, DEFAULT_NOTICES_URL],
  ])('falls back instead of exposing an empty, malformed, or active-content URL', (
    environment,
    sourceUrl,
    noticesUrl,
  ) => {
    expect(readAppConfig('', environment).legalLinks).toEqual({ sourceUrl, noticesUrl });
  });
});
