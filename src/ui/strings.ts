/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import type { CleanRuleId } from '../clean/types.ts';

export const STATIC_UI = {
  language: 'en',
  documentTitle: 'HTML fragment editor',
  metaDescription: 'A free, local HTML fragment editor with visual and source editing modes.',
  appTitle: 'HTML fragment editor',
  privacyNote: 'Your text is processed only in this browser and is never sent to a server.',
  ioToolsAriaLabel: 'Files, clipboard, and local draft',
  importFileAriaLabel: 'Choose an HTML or DOCX file to import',
  openFile: 'Open file',
  downloadHtml: 'Download HTML',
  copyHtml: 'Copy HTML',
  copyText: 'Copy text',
  loadExample: 'Example',
  newDocument: 'New document',
  dropFileHint: 'Drop an .html, .htm, or .docx file up to 5 MB here.',
  discardRestoredDraft: 'Start over',
  mobileTabsAriaLabel: 'Editor mode',
  visualTab: 'Visual',
  sourceTab: 'Code',
  editorWorkspaceAriaLabel: 'HTML editor',
  visualPanelTitle: 'Visual editor',
  visualEditorAriaLabel: 'Visual HTML editor',
  splitterAriaLabel: 'Resize editor panels',
  sourcePanelTitle: 'HTML code',
  wrapSource: 'Wrap lines',
  initialCharacterCount: '0 characters',
  sourceEditorHostAriaLabel: 'HTML source editor',
  editorsLoading: 'Editors are loading…',
  documentToolsAriaLabel: 'Clean and replace HTML',
  documentToolsTitle: 'Clean and replace',
  documentToolsDescription: 'Mass operations update both panels and share one undo history.',
  undo: 'Undo',
  noMassOperationsToUndo: 'No mass operations to undo.',
  cleaningTitle: 'Clean HTML',
  aiPriorityLabel: 'AI symbols:',
  aiPriorityDescription: 'a dedicated rule normalizes quotation marks, dashes, and invisible characters.',
  cleanSelected: 'Clean selected',
  formatHtml: 'Format',
  minifyHtml: 'Minify',
  replacementTitle: 'Find and replace',
  replacementDescription: 'Up to 10 rules; their order matters when applying all rules.',
  addReplacementRule: 'Add rule',
  applyAllReplacements: 'Apply all',
  normalizationNotice: 'The visual editor normalized the HTML. Indentation, line breaks, and unsupported markup may have changed.',
  appStatusLoading: 'Editors are loading…',
  appStatusReady: 'Editors are ready.',
  appStatusFailed: 'The editor failed to load.',
  errorTitle: 'The editor failed to load',
  errorDescription: 'Reload the page. If the problem persists, check that the local application files are available.',
} as const;

const requiredStaticElement = (root: Document, selector: string): Element => {
  const result = root.querySelector(selector);
  if (!result) throw new Error(`Required static UI element ${selector} is missing`);
  return result;
};

const replaceTrailingText = (root: Document, selector: string, value: string): void => {
  const target = requiredStaticElement(root, selector);
  for (const node of Array.from(target.childNodes)) {
    if (node.nodeType === 3) node.remove();
  }
  target.append(root.createTextNode(` ${value}`));
};

export const applyStaticUi = (root: Document = document): void => {
  root.documentElement.lang = STATIC_UI.language;
  root.title = STATIC_UI.documentTitle;
  requiredStaticElement(root, 'meta[name="description"]').setAttribute('content', STATIC_UI.metaDescription);

  const textBySelector: Readonly<Record<string, string>> = {
    '.app-header h1': STATIC_UI.appTitle,
    '.privacy-note': STATIC_UI.privacyNote,
    '#choose-import-file': STATIC_UI.openFile,
    '#export-html': STATIC_UI.downloadHtml,
    '#copy-html': STATIC_UI.copyHtml,
    '#copy-text': STATIC_UI.copyText,
    '#load-example': STATIC_UI.loadExample,
    '#new-document': STATIC_UI.newDocument,
    '#drop-file-hint': STATIC_UI.dropFileHint,
    '#discard-restored-draft': STATIC_UI.discardRestoredDraft,
    '#visual-tab': STATIC_UI.visualTab,
    '#source-tab': STATIC_UI.sourceTab,
    '#visual-panel .panel-title': STATIC_UI.visualPanelTitle,
    '#source-panel .panel-title': STATIC_UI.sourcePanelTitle,
    '#character-count': STATIC_UI.initialCharacterCount,
    '#loading-skeleton .sr-only': STATIC_UI.editorsLoading,
    '#document-tools .tools-header h2': STATIC_UI.documentToolsTitle,
    '#document-tools .tools-header p': STATIC_UI.documentToolsDescription,
    '#undo-mass-operation': STATIC_UI.undo,
    '#undo-mass-description': STATIC_UI.noMassOperationsToUndo,
    '#cleaning-title': STATIC_UI.cleaningTitle,
    '#clean-selected-rules': STATIC_UI.cleanSelected,
    '#format-html': STATIC_UI.formatHtml,
    '#minify-html': STATIC_UI.minifyHtml,
    '#replacement-title': STATIC_UI.replacementTitle,
    '.replacement-panel .tool-panel-header p': STATIC_UI.replacementDescription,
    '#add-replacement-rule': STATIC_UI.addReplacementRule,
    '#apply-all-replacements': STATIC_UI.applyAllReplacements,
    '#normalization-note': STATIC_UI.normalizationNotice,
    '#app-status': STATIC_UI.appStatusLoading,
    '#app-error h2': STATIC_UI.errorTitle,
    '#app-error p': STATIC_UI.errorDescription,
  };
  for (const [selector, value] of Object.entries(textBySelector)) {
    requiredStaticElement(root, selector).textContent = value;
  }

  const ariaLabelBySelector: Readonly<Record<string, string>> = {
    '#io-tools': STATIC_UI.ioToolsAriaLabel,
    '#import-file-input': STATIC_UI.importFileAriaLabel,
    '.mobile-tabs': STATIC_UI.mobileTabsAriaLabel,
    '#editor-workspace': STATIC_UI.editorWorkspaceAriaLabel,
    '#visual-editor': STATIC_UI.visualEditorAriaLabel,
    '#editor-splitter': STATIC_UI.splitterAriaLabel,
    '#source-editor': STATIC_UI.sourceEditorHostAriaLabel,
    '#document-tools': STATIC_UI.documentToolsAriaLabel,
  };
  for (const [selector, value] of Object.entries(ariaLabelBySelector)) {
    requiredStaticElement(root, selector).setAttribute('aria-label', value);
  }

  replaceTrailingText(root, '.wrap-control', STATIC_UI.wrapSource);
  requiredStaticElement(root, '.ai-priority strong').textContent = STATIC_UI.aiPriorityLabel;
  replaceTrailingText(root, '.ai-priority', STATIC_UI.aiPriorityDescription);
};

export const SOURCE_UI = {
  editorAriaLabel: 'HTML source',
} as const;

export const VISUAL_UI = {
  aboutMenu: 'About',
  sourceCode: 'Source code',
  thirdPartyNotices: 'Third-party notices',
  blockFormats:
    'Paragraph=p; Heading 1=h1; Heading 2=h2; Heading 3=h3; Heading 4=h4; ' +
    'Quote=blockquote; Preformatted=pre',
} as const;

export const formatCharacterCount = (count: number): string =>
  `${count.toLocaleString('en-US')} ${count === 1 ? 'character' : 'characters'}`;

export const CLEAN_RULE_COPY: Record<CleanRuleId, { readonly label: string; readonly description: string }> = {
  'inline-styles': {
    label: 'Inline styles',
    description: 'Removes style, align, valign, bgcolor, and other presentation attributes.',
  },
  'classes-and-ids': {
    label: 'Classes and IDs',
    description: 'Removes class and id attributes.',
  },
  'empty-elements': {
    label: 'Empty elements',
    description: 'Removes elements without meaningful content.',
  },
  'single-space-elements': {
    label: 'Single-space elements',
    description: 'Removes paragraphs whose only content is a single non-breaking space.',
  },
  'repeated-spaces': {
    label: 'Repeated spaces',
    description: 'Collapses consecutive regular and non-breaking spaces.',
  },
  comments: {
    label: 'Comments',
    description: 'Removes HTML comments.',
  },
  'tag-attributes': {
    label: 'Tag attributes',
    description: 'Keeps href on links and src and alt on images.',
  },
  'plain-text': {
    label: 'Plain text',
    description: 'Removes all markup while preserving the document text.',
  },
  'ai-symbols': {
    label: 'AI symbols',
    description: 'Normalizes quotation marks, dashes, narrow spaces, and invisible characters.',
  },
  'word-junk': {
    label: 'Word cleanup',
    description: 'Removes conditional comments, Microsoft Office attributes, classes, and empty spans.',
  },
};

export const DOCUMENT_TOOL_UI = {
  damagedCleaningSettings: 'Saved cleaning settings are damaged; the defaults have been restored.',
  staleOperation: 'The document changed during the operation, so its result was not applied.',
  noMassOperationsToUndo: STATIC_UI.noMassOperationsToUndo,
  operationFailed: 'The operation could not be completed.',
  noChanges: 'No changes.',
  apply: 'Apply',
  cleaningSettingNotSaved: 'The setting was changed, but it could not be saved in this browser.',
  noReplacementRules: 'No replacement rules have been added.',
  find: 'Find',
  replaceWith: 'Replace with',
  regularExpression: 'Regular expression',
  ignoreCase: 'Ignore case',
  remove: 'Remove',
  replacementRuleRemoved: 'The rule was removed.',
  applyingReplacementRules: 'Applying replacement rules…',
  applyAllReplacementsLabel: 'apply all replacements',
  selectCleaningRule: 'Select at least one cleaning rule.',
  cleaningDocument: 'Cleaning the document…',
  cleanSelectedLabel: 'clean with selected rules',
  formattingHtml: 'Formatting HTML…',
  formatHtmlLabel: 'format HTML',
  htmlFormatted: 'HTML formatted.',
  minifyingHtml: 'Minifying HTML…',
  minifyHtmlLabel: 'minify HTML',
  htmlMinified: 'HTML minified.',
  restoringDocument: 'Restoring the document…',
} as const;

export const documentToolMessage = {
  replacementCount: (count: number): string => `Replacements made: ${count}.`,
  undoAvailable: (label: string): string => `Can undo: ${label}.`,
  undoState: (prefix: string | undefined, next: string): string => prefix ? `${prefix} ${next}` : next,
  includeCleaningRuleAria: (label: string): string => `Include the “${label}” rule in the combined clean`,
  applyCleaningRuleAria: (label: string): string => `Apply the “${label}” rule`,
  applyingCleaningRule: (label: string): string => `Applying the “${label}” rule…`,
  cleaningRuleLabel: (label: string): string => `clean — ${label}`,
  cleaningRuleApplied: (label: string): string => `Applied the “${label}” rule.`,
  cleaningRuleUnchanged: (label: string): string => `The “${label}” rule found no changes.`,
  applyReplacementRuleAria: (index: number): string => `Apply replacement rule ${index}`,
  removeReplacementRuleAria: (index: number): string => `Remove replacement rule ${index}`,
  applyingReplacementRule: (index: number): string => `Applying replacement rule ${index}…`,
  replacementRuleLabel: (index: number): string => `replace — rule ${index}`,
  matchesWithoutChanges: (count: number): string => `Matches found: ${count}; the document did not change.`,
  replacementRuleErrors: (count: number): string => count > 0 ? ` Rule errors: ${count}.` : '',
  replacementSummary: (count: number, errorCount: number, changed: boolean): string => {
    const summary = changed || count === 0
      ? `Replacements made: ${count}.`
      : `Matches found: ${count}; the document did not change.`;
    const errors = errorCount > 0 ? ` Rule errors: ${errorCount}.` : '';
    return `${summary}${errors}`;
  },
  cleaningComplete: (count: number): string => `Cleaning complete. Rules applied: ${count}.`,
  undone: (label: string): string => `Undone: ${label}.`,
} as const;

export const REPLACE_RULE_ERRORS = {
  emptyFind: 'The search string cannot be empty.',
  findTooLong: (maxLength: number): string => `The search string cannot exceed ${maxLength} characters.`,
  replacementTooLong: (maxLength: number): string => `The replacement string cannot exceed ${maxLength} characters.`,
  invalidRegex: 'The regular expression is invalid.',
  workerStartFailed: 'The isolated regular expression check could not be started.',
  workerExecutionFailed: 'The regular expression could not be run in the isolated process.',
  workerTimedOut: (timeoutMs: number): string => `The regular expression ran for more than ${timeoutMs} ms and was stopped.`,
} as const;

export const REPLACE_STORAGE_ERRORS = {
  storedInvalidSchema: 'The saved rule set has an invalid format.',
  storedTooLarge: 'The saved rule set exceeds the allowed size.',
  storedInvalidJson: 'The saved rule set is damaged.',
  unsupportedVersion: 'The saved rule set version is not supported.',
  currentTooLarge: 'The rule set exceeds the allowed size.',
  readFailed: 'The saved rules could not be read.',
  writeFailed: 'The rules could not be saved.',
} as const;

export const IO_UI = {
  unsupportedExtension: 'Only .html, .htm, and .docx files are supported.',
  fileTooLarge: 'The file exceeds the 5 MB limit.',
  fileReadFailed: 'The selected file could not be read.',
  docxConversionFailed: 'The DOCX document could not be parsed.',
  importFailed: 'Import failed. The file is damaged or has an unsupported format.',
  draftTooLarge: 'The draft is larger than 1 MB. The last valid version is still saved; autosave will resume after the document is reduced.',
  draftSaveFailed: 'The draft could not be saved in this browser.',
  storedDraftTooLarge: 'The saved draft exceeds 1 MB and was not restored.',
  storedDraftInvalid: 'The saved draft is damaged and was not restored.',
  draftStorageUnavailable: 'Local storage is unavailable; the draft will not be saved.',
  staleOperation: 'The document changed during the operation, so the imported result was not applied.',
  alreadyContainsData: 'The document already contains this content.',
  selectImportFile: 'Choose a file to import.',
  importOneFile: 'Import one file at a time.',
  htmlDownloadReady: 'The HTML file is ready to download.',
  htmlDownloadFailed: 'The HTML file could not be downloaded.',
  sampleLoaded: 'The example document was loaded.',
  confirmNewDocument: 'Clear the document? Unsaved changes will remain only in the mass-operation history.',
  newDocumentCreated: 'A new document was created.',
  sampleMassLabel: 'load example',
  newDocumentMassLabel: 'new document',
} as const;

export type ClipboardContentKind = 'html' | 'text';

export const ioMessage = {
  importError: (code?: string): string => {
    if (code === 'unsupported-extension') return IO_UI.unsupportedExtension;
    if (code === 'file-too-large') return IO_UI.fileTooLarge;
    if (code === 'file-read-failed') return IO_UI.fileReadFailed;
    if (code === 'docx-conversion-failed') return IO_UI.docxConversionFailed;
    return IO_UI.importFailed;
  },
  clipboard: (
    kind: ClipboardContentKind,
    outcome: 'failed' | 'clipboard-api' | 'exec-command',
  ): string => {
    const label = kind === 'html' ? 'HTML' : 'Text';
    if (outcome === 'failed') return `${label} was not copied because the browser denied clipboard access.`;
    return outcome === 'clipboard-api'
      ? `${label} was copied to the clipboard.`
      : `${label} was copied using the fallback method.`;
  },
  restoredDraft: (savedAt: number): string =>
    `Restored a local draft saved ${new Date(savedAt).toLocaleString('en-US')}.`,
  parsingFile: (fileName: string): string => `Parsing ${fileName}…`,
  openingFile: (fileName: string): string => `Opening ${fileName}…`,
  importMassLabel: (fileName: string): string => `import ${fileName}`,
  docxImported: (fileName: string, warningCount: number): string => warningCount === 0
    ? `Imported ${fileName} without warnings.`
    : `Imported ${fileName}. Warnings: ${warningCount}.`,
  htmlImported: (fileName: string): string => `Imported ${fileName}.`,
} as const;

export const SAMPLE_HTML = `<!-- Extra comment for testing the cleaner -->
<h1 class="generated-title" style="letter-spacing: .02em">Dirty HTML example</h1>
<p style="font-family: Arial">This&nbsp;&nbsp;&nbsp;text contains   repeated spaces, “curly quotes”,
a zero-width&#8203;character, and <span class="temporary-mark">unnecessary classes</span>.</p>
<p><strong>Try</strong> the cleaning rules, formatting, and mass undo.</p>`;
