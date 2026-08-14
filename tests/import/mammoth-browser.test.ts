/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import { execFile } from 'node:child_process';
import { mkdtemp, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import { build } from 'vite';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { mammothBrowserAliases } from '../../scripts/mammoth-browser-aliases.mjs';

interface BrowserVerification {
  exports: string[];
  goldenMatched: boolean;
  goldenMessages: Array<{ type: string; message: string }>;
  wingdingsHtml: string;
  wingdingsMessages: Array<{ type: string; message: string }>;
}

const execFileAsync = promisify(execFile);
let verification: BrowserVerification;
let temporaryBuildRoot = '';

beforeAll(async () => {
  temporaryBuildRoot = await mkdtemp(join(tmpdir(), 'phphtmledit-mammoth-'));
  await build({
    configFile: false,
    logLevel: 'silent',
    resolve: {
      alias: mammothBrowserAliases(resolve('.')),
    },
    build: {
      copyPublicDir: false,
      emptyOutDir: true,
      minify: true,
      outDir: temporaryBuildRoot,
      target: ['es2020', 'chrome111', 'edge111', 'firefox114', 'safari16'],
      lib: {
        entry: resolve('src/import/mammoth-browser.ts'),
        fileName: 'mammoth-browser',
        formats: ['es'],
      },
    },
  });
  const outputName = (await readdir(temporaryBuildRoot))
    .find((name) => /^mammoth-browser.*\.js$/.test(name));
  if (!outputName) throw new Error('Vite did not emit the Mammoth browser test bundle');
  const { stdout } = await execFileAsync(process.execPath, [
    resolve('tests/import/verify-mammoth-browser-bundle.mjs'),
    resolve(temporaryBuildRoot, outputName),
  ]);
  verification = JSON.parse(stdout) as BrowserVerification;
});

afterAll(async () => {
  const systemTemporaryRoot = resolve(tmpdir());
  const resolvedBuildRoot = resolve(temporaryBuildRoot);
  const relativeBuildRoot = relative(systemTemporaryRoot, resolvedBuildRoot);
  if (
    temporaryBuildRoot &&
    relativeBuildRoot !== '' &&
    !relativeBuildRoot.startsWith('..') &&
    !isAbsolute(relativeBuildRoot)
  ) {
    await rm(resolvedBuildRoot, { recursive: true, force: true });
  }
});

describe('browser-optimized Mammoth wrapper', () => {
  it('exposes only the HTML conversion function at runtime', () => {
    expect(verification.exports).toEqual(['convertToHtml']);
  });

  it('matches the DOCX golden output without warnings', () => {
    expect(verification.goldenMatched).toBe(true);
    expect(verification.goldenMessages).toEqual([]);
  });

  it('retains dingbat-to-unicode for Wingdings symbols', () => {
    expect(verification.wingdingsHtml).toBe('<p>☺</p>');
    expect(verification.wingdingsMessages).toEqual([]);
  });
});
