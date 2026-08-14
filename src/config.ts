/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export type ResolvedTheme = 'light';

export interface AppConfig {
  readonly requestedTheme: string | null;
  readonly resolvedTheme: ResolvedTheme;
}

export const readAppConfig = (search = window.location.search): AppConfig => ({
  requestedTheme: new URLSearchParams(search).get('theme'),
  resolvedTheme: 'light',
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
