import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import {
  DEFAULT_FRAME_ANCESTORS,
  normalizeFrameAncestors,
  pagesHeadersPlugin,
  renderPagesHeaders,
} from '../../scripts/pages-headers.mjs';

const defaultHeaders = `/*
  X-Robots-Tag: noindex, nofollow
  Content-Security-Policy: frame-ancestors 'self' https://phphtmledit.com https://www.phphtmledit.com http://localhost:*

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/licenses.txt
  Content-Type: text/plain; charset=utf-8
`;

describe('Cloudflare Pages header artifact', () => {
  it('keeps the production and diagnostic header checks on their build paths', () => {
    const manifest = JSON.parse(readFileSync(join(process.cwd(), 'package.json'), 'utf8')) as {
      scripts?: Record<string, string>;
    };

    expect(manifest.scripts?.build).toMatch(/vite build && npm run hosting:evidence$/);
    expect(manifest.scripts?.['build:e0']).toContain('npm run hosting:evidence -- --include-diagnostic');
  });

  it('renders the exact default allow-list and delivery policies', () => {
    expect(DEFAULT_FRAME_ANCESTORS)
      .toBe("'self' https://phphtmledit.com https://www.phphtmledit.com http://localhost:*");
    expect(renderPagesHeaders()).toBe(defaultHeaders);
  });

  it('normalizes duplicates and permits an additional explicit HTTPS origin', () => {
    expect(normalizeFrameAncestors(
      "  'self' https://phphtmledit.com https://www.phphtmledit.com http://localhost:* " +
      "https://embed.example 'self'  ",
    )).toBe(
      "'self' https://phphtmledit.com https://www.phphtmledit.com http://localhost:* https://embed.example",
    );
  });

  it.each([
    ['', 'empty'],
    ["'self'\nX-Evil: injected https://phphtmledit.com https://www.phphtmledit.com http://localhost:*", 'line'],
    ["'self'; frame-src * https://phphtmledit.com https://www.phphtmledit.com http://localhost:*", 'directive'],
    ["'self' https://phphtmledit.com https://www.phphtmledit.com http://localhost:* https://phe-preview.com", 'reserved'],
    ["'self' https://phphtmledit.com https://www.phphtmledit.com http://localhost:* https://phe-preview.com.", 'reserved fqdn'],
    ["'self' https://phphtmledit.com https://www.phphtmledit.com http://localhost:* https://foo.phe-preview.com.", 'reserved subdomain fqdn'],
    ["'self' https://phphtmledit.com https://www.phphtmledit.com http://localhost:* https://*.phe-preview.com.", 'reserved wildcard fqdn'],
    ["'self' https://phphtmledit.com https://www.phphtmledit.com http://localhost:* https://phe-preview.com..", 'reserved malformed fqdn'],
    ["'self' https://phphtmledit.com https://www.phphtmledit.com", 'missing'],
    ["'self' https://phphtmledit.com/path https://www.phphtmledit.com http://localhost:*", 'invalid'],
  ])('rejects unsafe or incomplete FRAME_ANCESTORS (%s)', (value) => {
    expect(() => normalizeFrameAncestors(value)).toThrow();
  });

  it('keeps immutable caching limited to hashed application assets', () => {
    const headers = renderPagesHeaders();
    expect(headers.match(/immutable/g)).toHaveLength(1);
    expect(headers).not.toMatch(/\/tinymce\/\*/);
    expect(headers).not.toMatch(/X-Frame-Options/i);
    expect(headers).not.toMatch(/phe-preview\.com/i);
  });

  it('emits the extensionless artifact through the Vite build plugin', () => {
    const emitFile = vi.fn();
    const plugin = pagesHeadersPlugin();
    if (typeof plugin.generateBundle !== 'function') throw new Error('generateBundle is missing');

    plugin.generateBundle.call({ emitFile }, {}, {});

    expect(emitFile).toHaveBeenCalledTimes(1);
    expect(emitFile).toHaveBeenCalledWith({
      type: 'asset',
      fileName: '_headers',
      source: defaultHeaders,
    });
  });
});
