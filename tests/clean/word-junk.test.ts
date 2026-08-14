import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { applyCleanRule, cleanHtml } from '../../src/clean';

const sha256 = (value: string): string => createHash('sha256').update(value, 'utf8').digest('hex');

describe('word-junk cleaning rule', () => {
  it('removes representative Office metadata without deleting document text', () => {
    const input = '<!--[if gte mso 9]><xml>settings</xml><![endif]--><!--keep--><p class="MsoNormal keep" style="mso-margin-top-alt:auto;color:red" xmlns:o="urn:x" o:foo="x" data-ccp-props="{}" lang="en"><span><span> </span></span><span class="SpellE">Word</span><o:p>!</o:p><span class="EOP Selected">&nbsp;</span><strong class="TextRun"><em class="NormalTextRun">Semantic</em></strong></p>';
    const expected = '<!--keep--><p class="keep" style="color:red" lang="en">Word!<strong><em>Semantic</em></strong></p>';

    expect(applyCleanRule(input, 'word-junk').html).toBe(expected);
  });

  it('promotes combined Word text-run formatting without duplicating semantic ancestors', () => {
    const input = '<span class="TextRun SCX1" style="font-weight: 700; font-style: italic; text-decoration: underline">Combined</span><strong><span class="TextRun SCX1" style="font-weight: bold">Ancestor</span></strong><span class="TextRun SCX1" style="font-weight: bold; font-style: italic; text-decoration: underline"><strong>Child</strong></span>';
    const expected = '<strong><em><u>Combined</u></em></strong><strong>Ancestor</strong><em><u><strong>Child</strong></u></em>';

    expect(applyCleanRule(input, 'word-junk').html).toBe(expected);
  });

  it('normalizes Word text-run separators without changing non-Office NBSP', () => {
    const input = '<span class="TextRun SCX1">Word&nbsp;space</span><span>10&nbsp;kg</span>';
    const expected = 'Word space<span>10&nbsp;kg</span>';

    expect(applyCleanRule(input, 'word-junk').html).toBe(expected);
  });

  it('cleans the exact real Word clipboard fixture to its reviewed output', () => {
    const input = readFileSync(resolve('tests/fixtures/word-clipboard.html'), 'utf8');
    const expected = readFileSync(
      resolve('tests/fixtures/word-clipboard.expected.html'),
      'utf8',
    );
    const metadata = JSON.parse(
      readFileSync(resolve('tests/fixtures/word-clipboard.meta.json'), 'utf8'),
    ) as Record<string, unknown>;
    const wordOnly = applyCleanRule(input, 'word-junk').html;

    expect(Buffer.byteLength(input, 'utf8')).toBe(metadata.fixtureBytes);
    expect(sha256(input)).toBe(metadata.fixtureSha256);
    expect(Buffer.byteLength(expected, 'utf8')).toBe(metadata.expectedBytes);
    expect(sha256(expected)).toBe(metadata.expectedSha256);
    expect(input).not.toMatch(/https?:\/\/|www\./i);
    expect(input).not.toMatch(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    expect(wordOnly).not.toMatch(/\b(?:OutlineElement|Paragraph|TextRun|NormalTextRun|ListContainerWrapper|BulletListStyle1|SpellingErrorV2Themed|SCXW48048327|BCX8)\b/);
    expect(wordOnly).not.toMatch(/\s(?:paraid|paraeid|data-ccp-props|data-list(?:id|-defn-props))=/i);
    expect(wordOnly).toContain('<ul');
    expect(wordOnly).toContain('<li');
    expect(wordOnly).toContain('<p');
    const cleaned = cleanHtml(input).html;
    expect(cleaned).toBe(expected);
    expect(cleanHtml(cleaned).html).toBe(cleaned);
  });
});
