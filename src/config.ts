/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export type ResolvedTheme = 'light';

export interface LegalLinks {
  readonly sourceUrl: string;
  readonly noticesUrl: string;
}

export interface PublicBuildEnvironment {
  readonly VITE_SOURCE_URL?: string;
  readonly VITE_NOTICES_URL?: string;
}

export interface AppConfig {
  readonly requestedTheme: string | null;
  readonly resolvedTheme: ResolvedTheme;
  readonly legalLinks: LegalLinks;
}

export const DEFAULT_SOURCE_URL = 'https://github.com/phphtmledit/editor';
export const DEFAULT_NOTICES_URL = '/licenses.txt';

const isHttpUrl = (value: string): boolean => {
  try {
    const parsed = new URL(value, 'https://app.phphtmledit.com/');
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
};

const resolvePublicUrl = (value: string | undefined, fallback: string): string => {
  const candidate = value?.trim();
  return candidate && isHttpUrl(candidate) ? candidate : fallback;
};

export const readAppConfig = (
  search = window.location.search,
  environment: PublicBuildEnvironment = import.meta.env as PublicBuildEnvironment,
): AppConfig => ({
  requestedTheme: new URLSearchParams(search).get('theme'),
  resolvedTheme: 'light',
  legalLinks: {
    sourceUrl: resolvePublicUrl(environment.VITE_SOURCE_URL, DEFAULT_SOURCE_URL),
    noticesUrl: resolvePublicUrl(environment.VITE_NOTICES_URL, DEFAULT_NOTICES_URL),
  },
});

export const applyAppConfig = (
  config: AppConfig,
  root: HTMLElement = document.documentElement,
): void => {
  root.dataset.theme = config.resolvedTheme;
};

export const configureApp = (search = window.location.search): AppConfig => {
  const config = readAppConfig(search);
  applyAppConfig(config);
  return config;
};

export const appConfig = configureApp();
