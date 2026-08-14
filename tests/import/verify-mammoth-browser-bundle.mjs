/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const WINGDINGS_DOCX_BASE64 =
  'UEsDBAoAAAAIAKtDDl3XeYTq8QAAALgBAAATAAAAW0NvbnRlbnRfVHlwZXNdLnhtbH2QzU7DMBCE730Ky9cqccoBIZSkB36OwKE8wMreJFb9J69b2rdn00KREOVozXwz62nXB+/EHjPZGDq5qhspMOhobBg7+b55ru6koALBgIsBO3lEkut+0W6OCUkwHKiTUynpXinSE3qgOiYMrAwxeyj8zKNKoLcworppmlulYygYSlXmDNkvhGgfcYCdK+LpwMr5loyOpHg4e+e6TkJKzmoorKt9ML+Kqq+SmsmThyabaMkGqa6VzOL1jh/0lSfK1qB4g1xewLNRfcRslIl65xmu/0/649o4DFbjhZ/TUo4aiXh77+qL4sGG71+06jR8/wlQSwMECgAAAAAAq0MOXQAAAAAAAAAAAAAAAAYAAABfcmVscy9QSwMECgAAAAgAq0MOXSAbhuqyAAAALgEAAAsAAABfcmVscy8ucmVsc43Puw6CMBQG4J2naM4uBQdjDIXFmLAafICmPZRGeklbL7y9HRzEODie23fyN93TzOSOIWpnGdRlBQStcFJbxeAynDZ7IDFxK/nsLDJYMELXFs0ZZ57yTZy0jyQjNjKYUvIHSqOY0PBYOo82T0YXDE+5DIp6Lq5cId1W1Y6GTwPagpAVS3rJIPSyBjIsHv/h3ThqgUcnbgZt+vHlayPLPChMDB4uSCrf7TKzQHNKuorZvgBQSwMECgAAAAAAq0MOXQAAAAAAAAAAAAAAAAUAAAB3b3JkL1BLAwQKAAAACACrQw5dHaS+z7oAAAD3AAAAEQAAAHdvcmQvZG9jdW1lbnQueG1sNU5BjsIwDLz3FZHvSwpCCFVNEBfOewBxziaGVmrsKs5u6e9JYbmM7bFnPO3hEQf1h0l6JgPrVQ0KyXPo6W7gcj597UFJdhTcwIQGZhQ42KqdmsD+NyJlVRxImslAl/PYaC2+w+hkxSNS2d04RZfLmO564hTGxB5FyoM46E1d73R0PYGtlCquPxxmW+q4QFpA5qim5saUDVyLaokmUCjfuWTgVG+PoG2rX+f6Xyno83d60y/Lauk+ke0TUEsBAhQACgAAAAgAq0MOXdd5hOrxAAAAuAEAABMAAAAAAAAAAAAAAAAAAAAAAFtDb250ZW50X1R5cGVzXS54bWxQSwECFAAKAAAAAACrQw5dAAAAAAAAAAAAAAAABgAAAAAAAAAAABAAAAAiAQAAX3JlbHMvUEsBAhQACgAAAAgAq0MOXSAbhuqyAAAALgEAAAsAAAAAAAAAAAAAAAAARgEAAF9yZWxzLy5yZWxzUEsBAhQACgAAAAAAq0MOXQAAAAAAAAAAAAAAAAUAAAAAAAAAAAAQAAAAIQIAAHdvcmQvUEsBAhQACgAAAAgAq0MOXR2kvs+6AAAA9wAAABEAAAAAAAAAAAAAAAAARAIAAHdvcmQvZG9jdW1lbnQueG1sUEsFBgAAAAAFAAUAIAEAAC0DAAAAAA==';

const bundlePath = process.argv[2];
if (!bundlePath) throw new Error('Built Mammoth bundle path is required');
const mammoth = await import(pathToFileURL(bundlePath).href);
const compactMarkup = (value) => value.replace(/>\s+</g, '><').trim();
const asArrayBuffer = (bytes) =>
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
const [fixture, expected] = await Promise.all([
  readFile(resolve('tests/fixtures/mammoth-fixture.docx')),
  readFile(resolve('tests/fixtures/mammoth-fixture.expected.html'), 'utf8'),
]);
const wingdings = Buffer.from(WINGDINGS_DOCX_BASE64, 'base64');
const [goldenResult, wingdingsResult] = await Promise.all([
  mammoth.convertToHtml(asArrayBuffer(fixture)),
  mammoth.convertToHtml(asArrayBuffer(wingdings)),
]);

console.log(JSON.stringify({
  exports: Object.keys(mammoth),
  goldenMatched: compactMarkup(goldenResult.value) === compactMarkup(expected),
  goldenMessages: goldenResult.messages,
  wingdingsHtml: wingdingsResult.value,
  wingdingsMessages: wingdingsResult.messages,
}));
