const REQUIRED_FRAME_ANCESTORS = Object.freeze([
  "'self'",
  'https://phphtmledit.com',
  'https://www.phphtmledit.com',
  'http://localhost:*',
]);

export const DEFAULT_FRAME_ANCESTORS = REQUIRED_FRAME_ANCESTORS.join(' ');

const FRAME_SOURCE = /^(?:'self'|https?:\/\/(?:\*\.)?[a-z0-9.-]+(?::(?:\*|\d+))?)$/i;

const frameSourceHostname = (source) => {
  if (source === "'self'") return null;
  const withoutScheme = source.replace(/^https?:\/\//i, '');
  const withoutPort = withoutScheme.replace(/:(?:\*|\d+)$/, '');
  return withoutPort.replace(/^\*\./, '').replace(/\.+$/, '').toLowerCase();
};

export const normalizeFrameAncestors = (input = DEFAULT_FRAME_ANCESTORS) => {
  if (typeof input !== 'string') throw new TypeError('FRAME_ANCESTORS must be a string');
  if (/[\r\n;]/.test(input)) {
    throw new Error('FRAME_ANCESTORS must not contain line breaks or additional CSP directives');
  }

  const sources = input.trim().split(/\s+/).filter(Boolean);
  if (sources.length === 0) throw new Error('FRAME_ANCESTORS must not be empty');
  if (sources.some((source) => !FRAME_SOURCE.test(source))) {
    throw new Error('FRAME_ANCESTORS contains an invalid origin source');
  }
  if (sources.some((source) => {
    const hostname = frameSourceHostname(source);
    return hostname === 'phe-preview.com' || hostname?.endsWith('.phe-preview.com');
  })) {
    throw new Error('phe-preview.com is reserved for the negative frame-ancestors test');
  }

  const missing = REQUIRED_FRAME_ANCESTORS.filter((required) => !sources.includes(required));
  if (missing.length > 0) {
    throw new Error(`FRAME_ANCESTORS is missing required source(s): ${missing.join(', ')}`);
  }

  return [...new Set(sources)].join(' ');
};

export const renderPagesHeaders = (frameAncestors = DEFAULT_FRAME_ANCESTORS) => `/*
  X-Robots-Tag: noindex, nofollow
  Content-Security-Policy: frame-ancestors ${normalizeFrameAncestors(frameAncestors)}

/assets/*
  Cache-Control: public, max-age=31536000, immutable

/licenses.txt
  Content-Type: text/plain; charset=utf-8
`;

export const pagesHeadersPlugin = (frameAncestors = DEFAULT_FRAME_ANCESTORS) => ({
  name: 'phphtmledit-pages-headers',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: '_headers',
      source: renderPagesHeaders(frameAncestors),
    });
  },
});
