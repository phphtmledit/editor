import { readFileSync, readdirSync } from 'node:fs';
import { extname, join, relative, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(import.meta.dirname, '../..');
const cssPath = join(root, 'src/styles/app.css');
const css = readFileSync(cssPath, 'utf8');
const indexHtml = readFileSync(join(root, 'index.html'), 'utf8');

const REQUIRED_TOKENS = [
  'accent',
  'accent-soft',
  'bg',
  'surface',
  'border',
  'text',
  'text-muted',
  'radius',
] as const;

const COLOR_TOKEN_VALUES = {
  accent: '#0B6BCB',
  'accent-soft': '#E6F1FB',
  bg: '#F4F6F9',
  surface: '#FFFFFF',
  border: '#CCD3DF',
  text: '#172033',
  'text-muted': '#5E6879',
} as const;

const COLOR_LITERAL = /(?<!&)#[\da-f]{3,8}(?![\w-])|(?:rgb|hsl)a?\s*\(/gi;
const OLD_ACCENT = /#4f46e5|rgba?\(\s*79(?:\s*,\s*|\s+)70(?:\s*,\s*|\s+)229\b/i;

const sourceFiles = (directory: string): string[] => readdirSync(directory, { withFileTypes: true })
  .flatMap((entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? sourceFiles(path) : [path];
  })
  .filter((path) => ['.ts', '.css', '.js', '.cjs'].includes(extname(path)));

const productionFiles = (directory: string): string[] => sourceFiles(directory)
  .filter((path) => !relative(root, path).replaceAll('\\', '/').startsWith('src/e0/'));

const tokenValue = (name: string): string => {
  const match = css.match(new RegExp(`--phe-${name}:\\s*([^;]+);`));
  if (!match?.[1]) throw new Error(`Missing --phe-${name}`);
  return match[1].trim();
};

const luminance = (hex: string): number => {
  const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
  return channels
    .map((channel) => channel <= 0.04045
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4)
    .reduce((sum, channel, index) => sum + channel * [0.2126, 0.7152, 0.0722][index]!, 0);
};

const contrast = (first: string, second: string): number => {
  const firstLuminance = luminance(first);
  const secondLuminance = luminance(second);
  return (Math.max(firstLuminance, secondLuminance) + 0.05) /
    (Math.min(firstLuminance, secondLuminance) + 0.05);
};

const blendOver = (foreground: string, background: string, opacity: number): string => {
  const channels = [1, 3, 5].map((offset) => {
    const foregroundChannel = Number.parseInt(foreground.slice(offset, offset + 2), 16);
    const backgroundChannel = Number.parseInt(background.slice(offset, offset + 2), 16);
    return Math.round(foregroundChannel * opacity + backgroundChannel * (1 - opacity));
  });
  return `#${channels.map((channel) => channel.toString(16).padStart(2, '0')).join('')}`;
};

const blockBody = (source: string, header: string): string => {
  const headerStart = source.indexOf(header);
  const openingBrace = source.indexOf('{', headerStart);
  if (headerStart < 0 || openingBrace < 0) return '';

  let depth = 0;
  for (let index = openingBrace; index < source.length; index += 1) {
    if (source[index] === '{') depth += 1;
    if (source[index] !== '}') continue;
    depth -= 1;
    if (depth === 0) return source.slice(openingBrace + 1, index);
  }
  return '';
};

const opacityAffecting = (selectorFragment: string): number => {
  const opacities = [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
    .filter((match) => match[1]?.includes(selectorFragment))
    .flatMap((match) => [...(match[2] ?? '').matchAll(/(?:^|;)\s*opacity\s*:\s*(0?\.\d+|1(?:\.0+)?)\s*;?/g)])
    .map((match) => Number(match[1]));
  return opacities.reduce((product, opacity) => product * opacity, 1);
};

const touchMediaStart = css.indexOf('@media (pointer: coarse), (max-width: 899px)');
const touchMediaEnd = css.indexOf('@media (prefers-reduced-motion: reduce)', touchMediaStart);
const touchCss = touchMediaStart >= 0 && touchMediaEnd > touchMediaStart
  ? css.slice(touchMediaStart, touchMediaEnd)
  : '';

const touchDeclarations = (acceptedSelectors: readonly string[]): string | null => {
  for (const match of touchCss.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selectors = (match[1] ?? '').split(',').map((selector) => selector.trim());
    if (selectors.some((selector) => acceptedSelectors.includes(selector))) return match[2] ?? '';
  }
  return null;
};

const expectTouchTarget = (
  label: string,
  selectors: readonly string[],
  requiredDimensions: readonly ('width' | 'height')[],
): void => {
  const declarations = touchDeclarations(selectors);
  expect(declarations, `${label} is absent from the coarse/mobile touch rules`).not.toBeNull();
  for (const dimension of requiredDimensions) {
    expect(declarations, `${label} has no ${dimension}: 44px touch size`)
      .toMatch(new RegExp(`(?:min-)?${dimension}:\\s*44px`));
  }
};

describe('E4 visual contract', () => {
  it('reserves the mobile tab row before editor initialisation without showing it on desktop', () => {
    const document = new DOMParser().parseFromString(indexHtml, 'text/html');
    const tabs = document.querySelector<HTMLElement>('.mobile-tabs');
    const baseRule = blockBody(css, '.mobile-tabs');
    const mobileMedia = blockBody(css, '@media (max-width: 899px)');
    const mobileRule = blockBody(mobileMedia, '.mobile-tabs');

    expect(tabs).not.toBeNull();
    expect(tabs?.hasAttribute('hidden')).toBe(false);
    expect(baseRule).toMatch(/(?:^|;)\s*display:\s*none\s*;/);
    expect(mobileRule).toMatch(/(?:^|;)\s*display:\s*grid\s*;/);
  });

  it('declares the light-only palette and uses no color literals outside it', () => {
    REQUIRED_TOKENS.forEach((name) => expect(tokenValue(name)).not.toBe(''));
    for (const [name, expected] of Object.entries(COLOR_TOKEN_VALUES)) {
      expect(tokenValue(name)).toBe(expected);
    }
    expect(css).toContain('color-scheme: light;');
    expect(css).not.toContain('#818CF8');

    const projectOwnedUiFiles = [join(root, 'index.html'), ...sourceFiles(join(root, 'src'))];
    projectOwnedUiFiles.forEach((path) => {
      expect(readFileSync(path, 'utf8'), relative(root, path).replaceAll('\\', '/')).not.toMatch(OLD_ACCENT);
    });

    const rootRule = css.match(/:root\s*\{([^}]*)\}/s)?.[1] ?? '';
    let cssWithoutTokenDeclarations = css;
    for (const [name, value] of Object.entries(COLOR_TOKEN_VALUES)) {
      const declaration = `--phe-${name}: ${value};`;
      expect(rootRule).toContain(declaration);
      cssWithoutTokenDeclarations = cssWithoutTokenDeclarations.replace(declaration, '');
    }

    const files = [join(root, 'index.html'), ...productionFiles(join(root, 'src'))];
    const offenders = files.flatMap((path) => {
      const source = path === cssPath ? cssWithoutTokenDeclarations : readFileSync(path, 'utf8');
      const literals = source.match(COLOR_LITERAL) ?? [];
      return literals.map((literal) => `${relative(root, path).replaceAll('\\', '/')}: ${literal}`);
    });
    expect(offenders).toEqual([]);
  });

  it('keeps every application text pairing above 4.5:1', () => {
    const colors = Object.fromEntries(
      ['accent', 'accent-soft', 'bg', 'surface', 'text', 'text-muted']
        .map((name) => [name, tokenValue(name)]),
    );
    const pairs = [
      ['text', 'surface'],
      ['text', 'bg'],
      ['text-muted', 'surface'],
      ['text-muted', 'bg'],
      ['surface', 'accent'],
      ['text', 'accent-soft'],
      ['text-muted', 'accent-soft'],
    ] as const;

    pairs.forEach(([foreground, background]) => {
      expect(contrast(colors[foreground]!, colors[background]!)).toBeGreaterThanOrEqual(4.5);
    });
  });

  it('uses the soft accent only for background states', () => {
    const rules = sourceFiles(join(root, 'src'))
      .filter((path) => extname(path) === '.css')
      .flatMap((path) => [...readFileSync(path, 'utf8').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
        .map((rule) => ({ selector: rule[1] ?? '', body: rule[2] ?? '', path })));
    const declarations = rules
      .flatMap(({ body, path }) => body.split(';')
        .map((declaration) => declaration.trim())
        .filter((declaration) => declaration.includes('var(--phe-accent-soft)'))
        .map((declaration) => ({ declaration, path })));

    expect(declarations).not.toEqual([]);
    declarations.forEach(({ declaration, path }) => {
      expect(declaration, relative(root, path).replaceAll('\\', '/'))
        .toMatch(/^background(?:-color)?\s*:/);
    });
    rules
      .filter(({ body }) => body.includes('var(--phe-accent-soft)'))
      .forEach(({ body, path, selector }) => {
        expect(body, `${relative(root, path).replaceAll('\\', '/')}: ${selector.trim()}`)
          .not.toMatch(/(?:^|;)\s*color\s*:\s*var\(--phe-accent\)/);
      });
    expect(css).toMatch(/\.tox-dialog__body-nav-item:focus\s*\{[^}]*color:\s*var\(--phe-text\)[^}]*background-color:\s*var\(--phe-accent-soft\)/s);
    expect(css).toMatch(/\.tox-mbtn--active,[^}]*\{[^}]*color:\s*var\(--phe-text\)[^}]*background:\s*var\(--phe-accent-soft\)/s);
  });

  it('pins native checkbox, radio and range controls to the application accent', () => {
    const nativeControlRule = css.match(
      /input\[type="checkbox"\],\s*input\[type="radio"\],\s*input\[type="range"\]\s*\{([^}]*)\}/s,
    )?.[1] ?? '';

    expect(nativeControlRule).toContain('accent-color: var(--phe-accent);');
  });

  it('keeps live busy-state text above 4.5:1 after ancestor opacity is applied', () => {
    const foreground = tokenValue('text-muted');
    const background = tokenValue('surface');
    const liveRegions = [
      ['DOCX/import status', '.io-feedback'],
      ['mass-operation status', '.tool-panel[aria-busy="true"]'],
    ] as const;

    for (const [label, selector] of liveRegions) {
      const effective = blendOver(foreground, background, opacityAffecting(selector));
      expect(contrast(effective, background), `${label} contrast`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('uses the full accent for focus and declares 44px touch controls', () => {
    expect(css).toMatch(/button:focus-visible\s*\{[^}]*outline:\s*3px solid var\(--phe-accent\)/s);
    expect(css).toContain('--tox-private-button-focus-outline: 0 0 0 2px var(--phe-accent);');
    expect(css).toMatch(/body \.tox \.tox-mbtn:focus:not\(:disabled\)::after[^}]*var\(--phe-accent\)/s);
    expect(touchCss).not.toBe('');

    const both = ['width', 'height'] as const;
    expectTouchTarget('native buttons', ['button'], both);
    expectTouchTarget('line-wrap label', ['.wrap-control'], both);
    expectTouchTarget('cleaning checkbox label', ['.cleaning-rule-name'], ['height']);
    expectTouchTarget('replacement option labels', ['.rule-options label'], both);
    expectTouchTarget(
      'replacement text fields',
      ['.replacement-fields input', '.replacement-fields input[type="text"]'],
      ['height'],
    );
    expectTouchTarget('desktop coarse-pointer splitter', ['.editor-splitter'], ['width']);
    expectTouchTarget('TinyMCE toolbar buttons', ['.tox .tox-tbtn'], both);
    expectTouchTarget('TinyMCE menu buttons', ['.tox .tox-mbtn'], both);
    expectTouchTarget('TinyMCE dialog buttons', ['.tox .tox-button'], both);
    expectTouchTarget('TinyMCE menu items', ['.tox .tox-collection__item'], ['height']);
    expectTouchTarget('TinyMCE dialog navigation', ['.tox .tox-dialog__body-nav-item'], ['height']);
    expectTouchTarget('TinyMCE status path buttons', ['.tox .tox-statusbar__path-item'], both);
    expectTouchTarget('TinyMCE text fields', ['.tox .tox-textfield', 'body .tox .tox-textfield'], ['height']);
  });
});
