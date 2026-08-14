/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import type { ReplaceRule, ReplaceRuleResult } from './types';

export interface RegexWorkerRequest {
  readonly html: string;
  readonly rule: ReplaceRule;
}

export type RegexWorkerResponse =
  | { readonly ok: true; readonly result: ReplaceRuleResult }
  | { readonly ok: false };
