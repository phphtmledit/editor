/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

export const CLEAN_RULE_IDS = [
  'inline-styles',
  'classes-and-ids',
  'empty-elements',
  'single-space-elements',
  'repeated-spaces',
  'comments',
  'tag-attributes',
  'plain-text',
  'ai-symbols',
  'word-junk',
] as const;

export type CleanRuleId = (typeof CLEAN_RULE_IDS)[number];

export interface CleanRule {
  readonly id: CleanRuleId;
  readonly label: string;
  readonly enabledByDefault: boolean;
  apply(root: HTMLElement): void;
}

export interface CleanResult {
  readonly html: string;
  readonly changed: boolean;
  readonly appliedRuleIds: readonly CleanRuleId[];
}
