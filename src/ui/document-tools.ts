/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */
import {
  applyCleanRule,
  cleanHtmlCooperatively,
  CLEAN_RULE_IDS,
  DEFAULT_CLEAN_RULE_IDS,
  formatHtml,
  minifyHtml,
  type CleanRuleId,
} from '../clean';
import type { MassDocumentController } from '../editor/mass-document';
import type { SourceEditorController } from '../editor/source';
import type { SyncController } from '../editor/sync';
import {
  applyReplaceRule,
  applyReplaceRules,
  loadReplaceRules,
  MAX_REPLACE_FIELD_LENGTH,
  MAX_REPLACE_RULES,
  saveReplaceRules,
  validateReplaceRegex,
  type ReplaceRule,
  type ReplaceRuleError,
} from '../replace';

type ToolSourcePort = Pick<SourceEditorController, 'getHtml'>;
type ToolSyncPort = Pick<SyncController, 'flushActive'>;
type ToolStorage = Pick<Storage, 'getItem' | 'setItem'>;

export interface DocumentToolsController {
  destroy: () => void;
}

export const CLEAN_SETTINGS_STORAGE_KEY = 'phphtmledit.cleaning-settings.v1';
export const CLEAN_SETTINGS_STORAGE_VERSION = 1;

const CLEAN_RULE_COPY: Record<CleanRuleId, { label: string; description: string }> = {
  'inline-styles': {
    label: 'Инлайн-стили',
    description: 'Удаляет style, align, valign, bgcolor и другие атрибуты оформления.',
  },
  'classes-and-ids': {
    label: 'Классы и ID',
    description: 'Удаляет атрибуты class и id.',
  },
  'empty-elements': {
    label: 'Пустые теги',
    description: 'Удаляет элементы без значимого содержимого.',
  },
  'single-space-elements': {
    label: 'Теги с одним пробелом',
    description: 'Удаляет абзацы с единственным неразрывным пробелом.',
  },
  'repeated-spaces': {
    label: 'Повторяющиеся пробелы',
    description: 'Схлопывает идущие подряд обычные и неразрывные пробелы.',
  },
  comments: {
    label: 'Комментарии',
    description: 'Удаляет комментарии HTML.',
  },
  'tag-attributes': {
    label: 'Атрибуты тегов',
    description: 'Оставляет href у ссылок и src с alt у изображений.',
  },
  'plain-text': {
    label: 'Только текст',
    description: 'Убирает всю разметку, сохраняя текст документа.',
  },
  'ai-symbols': {
    label: 'Символы ИИ',
    description: 'Нормализует кавычки, тире, узкие пробелы и невидимые символы.',
  },
  'word-junk': {
    label: 'Мусор из Word',
    description: 'Удаляет условные комментарии, офисные атрибуты, классы и пустые span.',
  },
};

const required = <T extends HTMLElement>(root: Document, id: string): T => {
  const result = root.getElementById(id);
  if (!(result instanceof HTMLElement)) throw new Error(`Required element #${id} is missing`);
  return result as T;
};

const createElement = <K extends keyof HTMLElementTagNameMap>(
  root: Document,
  tagName: K,
  className?: string,
): HTMLElementTagNameMap[K] => {
  const result = root.createElement(tagName);
  if (className) result.className = className;
  return result;
};

const isCleanRuleId = (value: unknown): value is CleanRuleId =>
  typeof value === 'string' && (CLEAN_RULE_IDS as readonly string[]).includes(value);

const defaultCleanRuleIds = (): Set<CleanRuleId> => new Set(DEFAULT_CLEAN_RULE_IDS);

const loadCleanRuleIds = (
  storage: ToolStorage | undefined,
): { enabled: Set<CleanRuleId>; warning: string | null } => {
  try {
    const target = storage ?? globalThis.localStorage;
    const raw = target.getItem(CLEAN_SETTINGS_STORAGE_KEY);
    if (raw === null) return { enabled: defaultCleanRuleIds(), warning: null };
    if (raw.length > 4_096) throw new Error('Cleaning settings are too large');

    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      throw new Error('Invalid cleaning settings');
    }
    const record = parsed as Record<string, unknown>;
    if (
      record.version !== CLEAN_SETTINGS_STORAGE_VERSION ||
      !Array.isArray(record.enabledRuleIds) ||
      record.enabledRuleIds.length > CLEAN_RULE_IDS.length ||
      !record.enabledRuleIds.every(isCleanRuleId) ||
      new Set(record.enabledRuleIds).size !== record.enabledRuleIds.length
    ) {
      throw new Error('Unsupported cleaning settings');
    }
    return { enabled: new Set(record.enabledRuleIds), warning: null };
  } catch {
    return {
      enabled: defaultCleanRuleIds(),
      warning: 'Сохранённые настройки очистки повреждены; восстановлены значения по умолчанию.',
    };
  }
};

const saveCleanRuleIds = (
  enabled: ReadonlySet<CleanRuleId>,
  storage: ToolStorage | undefined,
): boolean => {
  try {
    const target = storage ?? globalThis.localStorage;
    target.setItem(CLEAN_SETTINGS_STORAGE_KEY, JSON.stringify({
      version: CLEAN_SETTINGS_STORAGE_VERSION,
      enabledRuleIds: CLEAN_RULE_IDS.filter((ruleId) => enabled.has(ruleId)),
    }));
    return true;
  } catch {
    return false;
  }
};

const replacementCount = (count: number): string => `Выполнено замен: ${count}.`;
const staleOperationMessage = 'Документ изменился во время операции; результат не применён.';

type SafeReplaceModule = Pick<
  typeof import('../replace/safe'),
  'applyReplaceRuleSafe' | 'applyReplaceRulesSafe'
>;

let safeReplaceModulePromise: Promise<SafeReplaceModule> | null = null;
const loadSafeReplaceModule = (): Promise<SafeReplaceModule> => {
  safeReplaceModulePromise ??= import('../replace/safe');
  return safeReplaceModulePromise;
};

export const createDocumentToolsController = (
  source: ToolSourcePort,
  sync: ToolSyncPort,
  massDocument: MassDocumentController,
  root: Document = document,
  storage?: ToolStorage,
): DocumentToolsController => {
  const documentTools = required<HTMLElement>(root, 'document-tools');
  const undoButton = required<HTMLButtonElement>(root, 'undo-mass-operation');
  const undoDescription = required<HTMLOutputElement>(root, 'undo-mass-description');
  const cleaningRuleList = required<HTMLElement>(root, 'cleaning-rule-list');
  const cleanSelectedButton = required<HTMLButtonElement>(root, 'clean-selected-rules');
  const formatButton = required<HTMLButtonElement>(root, 'format-html');
  const minifyButton = required<HTMLButtonElement>(root, 'minify-html');
  const cleaningResult = required<HTMLOutputElement>(root, 'cleaning-result');
  const addReplacementButton = required<HTMLButtonElement>(root, 'add-replacement-rule');
  const replacementRuleList = required<HTMLElement>(root, 'replacement-rule-list');
  const applyAllReplacementsButton = required<HTMLButtonElement>(root, 'apply-all-replacements');
  const replacementResult = required<HTMLOutputElement>(root, 'replacement-result');
  const cleaningPanel = cleaningRuleList.closest<HTMLElement>('.tool-panel') ?? documentTools;
  const replacementPanel = replacementRuleList.closest<HTMLElement>('.tool-panel') ?? documentTools;
  const view = root.defaultView ?? window;
  const cleanups: Array<() => void> = [];
  const cleanCheckboxes = new Map<CleanRuleId, HTMLInputElement>();
  const loadedCleanSettings = loadCleanRuleIds(storage);
  const enabledCleanRules = loadedCleanSettings.enabled;
  const loadedReplaceRules = loadReplaceRules(storage);
  let replaceRules: ReplaceRule[] = loadedReplaceRules.ok ? loadedReplaceRules.rules : [];
  let replacementIdSequence = 0;
  let busy = false;
  let destroyed = false;
  let frameHandle: number | null = null;
  let timerHandle: number | null = null;
  const supportsAnimationFrame = typeof view.requestAnimationFrame === 'function';

  const nextReplacementId = (): string => {
    let id = '';
    do {
      replacementIdSequence += 1;
      id = `rule-${Date.now().toString(36)}-${replacementIdSequence.toString(36)}`;
    } while (replaceRules.some((rule) => rule.id === id));
    return id;
  };

  const renderUndoState = (prefix?: string): void => {
    const state = massDocument.getUndoState();
    undoButton.disabled = busy || state.count === 0;
    const next = state.nextLabel ? `Можно отменить: ${state.nextLabel}.` : 'Нет операций для отмены.';
    undoDescription.textContent = prefix ? `${prefix} ${next}` : next;
  };

  const updateControls = (): void => {
    documentTools.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input').forEach((control) => {
      control.disabled = busy;
    });
    if (!busy) {
      addReplacementButton.disabled = replaceRules.length >= MAX_REPLACE_RULES;
      applyAllReplacementsButton.disabled = replaceRules.length === 0;
      undoButton.disabled = massDocument.getUndoState().count === 0;
    }
  };

  const finishDeferredOperation = (panel: HTMLElement): void => {
    panel.setAttribute('aria-busy', 'false');
    busy = false;
    updateControls();
  };

  const requestFrame = (callback: FrameRequestCallback): number => {
    if (supportsAnimationFrame) {
      return view.requestAnimationFrame(callback);
    }
    return view.setTimeout(() => callback(view.performance.now()), 0);
  };

  const runDeferred = (
    panel: HTMLElement,
    status: HTMLOutputElement,
    busyMessage: string,
    operation: () => void | Promise<void>,
  ): void => {
    if (busy || destroyed) return;
    busy = true;
    panel.setAttribute('aria-busy', 'true');
    status.textContent = busyMessage;
    updateControls();

    frameHandle = requestFrame(() => {
      frameHandle = null;
      if (destroyed) return;
      // The timer lets the browser paint aria-busy and the status before parsing a large document.
      timerHandle = view.setTimeout(async () => {
        timerHandle = null;
        if (destroyed) return;
        try {
          await operation();
        } catch (error: unknown) {
          console.error('Document operation failed', error);
          status.textContent = 'Не удалось выполнить операцию.';
        } finally {
          finishDeferredOperation(panel);
        }
      }, 0);
    });
  };

  const applyMassResult = (
    snapshotHtml: string,
    nextHtml: string,
    label: string,
    changedMessage: string,
    unchangedMessage: string,
    status: HTMLOutputElement,
  ): void => {
    if (nextHtml === snapshotHtml) {
      status.textContent = unchangedMessage;
      return;
    }
    const applied = massDocument.apply(label, nextHtml, snapshotHtml);
    status.textContent = applied.html === snapshotHtml ? unchangedMessage : changedMessage;
  };

  const snapshotIsCurrent = (snapshotHtml: string, status: HTMLOutputElement): boolean => {
    // An async cleaner or regex Worker must never overwrite edits made while
    // it was running. Flush whichever editor became authoritative, then
    // compare the current document with the exact input snapshot.
    sync.flushActive();
    if (source.getHtml() === snapshotHtml) return true;
    status.textContent = staleOperationMessage;
    return false;
  };

  const runTransform = (
    panel: HTMLElement,
    status: HTMLOutputElement,
    busyMessage: string,
    label: string,
    transform: (snapshotHtml: string) => string | Promise<string>,
    changedMessage: string,
    unchangedMessage = 'Изменений нет.',
  ): void => {
    runDeferred(panel, status, busyMessage, async () => {
      sync.flushActive();
      const snapshotHtml = source.getHtml();
      const nextHtml = await transform(snapshotHtml);
      if (!snapshotIsCurrent(snapshotHtml, status)) return;
      applyMassResult(
        snapshotHtml,
        nextHtml,
        label,
        changedMessage,
        unchangedMessage,
        status,
      );
    });
  };

  for (const ruleId of CLEAN_RULE_IDS) {
    const copy = CLEAN_RULE_COPY[ruleId];
    const row = createElement(root, 'div', 'cleaning-rule');
    if (ruleId === 'ai-symbols') row.classList.add('is-priority');

    const checkbox = createElement(root, 'input');
    checkbox.type = 'checkbox';
    checkbox.id = `clean-rule-${ruleId}`;
    checkbox.checked = enabledCleanRules.has(ruleId);
    checkbox.setAttribute('aria-label', `Включить правило «${copy.label}» в общую очистку`);
    cleanCheckboxes.set(ruleId, checkbox);

    const label = createElement(root, 'label', 'cleaning-rule-name');
    label.htmlFor = checkbox.id;
    label.append(copy.label);
    const description = createElement(root, 'span', 'cleaning-rule-description');
    description.textContent = copy.description;
    label.append(description);

    const applyButton = createElement(root, 'button');
    applyButton.type = 'button';
    applyButton.textContent = 'Применить';
    applyButton.setAttribute('aria-label', `Применить правило «${copy.label}»`);

    const onSettingChange = (): void => {
      if (checkbox.checked) enabledCleanRules.add(ruleId);
      else enabledCleanRules.delete(ruleId);
      if (!saveCleanRuleIds(enabledCleanRules, storage)) {
        cleaningResult.textContent = 'Настройка изменена, но сохранить её в браузере не удалось.';
      }
    };
    const onApply = (): void => {
      runTransform(
        cleaningPanel,
        cleaningResult,
        `Применяем правило «${copy.label}»…`,
        `очистка — ${copy.label}`,
        (html) => applyCleanRule(html, ruleId).html,
        `Применено правило «${copy.label}».`,
        `Правило «${copy.label}» не нашло изменений.`,
      );
    };
    checkbox.addEventListener('change', onSettingChange);
    applyButton.addEventListener('click', onApply);
    cleanups.push(
      () => checkbox.removeEventListener('change', onSettingChange),
      () => applyButton.removeEventListener('click', onApply),
    );
    row.append(checkbox, label, applyButton);
    cleaningRuleList.append(row);
  }

  if (loadedCleanSettings.warning) cleaningResult.textContent = loadedCleanSettings.warning;

  const setReplacementError = (index: number, error: ReplaceRuleError | null): void => {
    const row = replacementRuleList.children.item(index);
    if (!(row instanceof HTMLElement)) return;
    const findInput = row.querySelector<HTMLInputElement>('[data-field="find"]');
    const replacementInput = row.querySelector<HTMLInputElement>('[data-field="replacement"]');
    const errorOutput = row.querySelector<HTMLElement>('[data-role="error"]');
    const findInvalid = error !== null && error.code !== 'replacement-too-long';
    const replacementInvalid = error?.code === 'replacement-too-long';
    findInput?.setAttribute('aria-invalid', String(findInvalid));
    replacementInput?.setAttribute('aria-invalid', String(replacementInvalid));
    if (errorOutput) errorOutput.textContent = error?.message ?? '';
  };

  const persistReplaceRules = (): boolean => {
    const saved = saveReplaceRules(replaceRules, storage);
    if (!saved.ok) {
      replacementResult.textContent = saved.error.message;
      return false;
    }
    return true;
  };

  const renderReplaceRules = (): void => {
    replacementRuleList.replaceChildren();
    if (replaceRules.length === 0) {
      const empty = createElement(root, 'p', 'tool-result');
      empty.textContent = 'Правила замены не добавлены.';
      replacementRuleList.append(empty);
    }

    replaceRules.forEach((rule, index) => {
      const row = createElement(root, 'div', 'replacement-rule');
      row.dataset.ruleIndex = String(index);
      const fields = createElement(root, 'div', 'replacement-fields');

      const findLabel = createElement(root, 'label');
      findLabel.append('Найти');
      const findInput = createElement(root, 'input');
      findInput.type = 'text';
      findInput.maxLength = MAX_REPLACE_FIELD_LENGTH;
      findInput.value = rule.find;
      findInput.dataset.field = 'find';
      findInput.setAttribute('aria-invalid', 'false');
      findLabel.append(findInput);

      const replacementLabel = createElement(root, 'label');
      replacementLabel.append('Заменить на');
      const replacementInput = createElement(root, 'input');
      replacementInput.type = 'text';
      replacementInput.maxLength = MAX_REPLACE_FIELD_LENGTH;
      replacementInput.value = rule.replacement;
      replacementInput.dataset.field = 'replacement';
      replacementInput.setAttribute('aria-invalid', 'false');
      replacementLabel.append(replacementInput);
      fields.append(findLabel, replacementLabel);

      const options = createElement(root, 'div', 'rule-options');
      const regexLabel = createElement(root, 'label');
      const regexInput = createElement(root, 'input');
      regexInput.type = 'checkbox';
      regexInput.checked = rule.isRegex;
      regexInput.dataset.field = 'isRegex';
      regexLabel.append(regexInput, ' Регулярное выражение');

      const caseLabel = createElement(root, 'label');
      const caseInput = createElement(root, 'input');
      caseInput.type = 'checkbox';
      caseInput.checked = rule.ignoreCase;
      caseInput.dataset.field = 'ignoreCase';
      caseLabel.append(caseInput, ' Игнорировать регистр');

      const applyButton = createElement(root, 'button');
      applyButton.type = 'button';
      applyButton.dataset.action = 'apply';
      applyButton.textContent = 'Применить';
      applyButton.setAttribute('aria-label', `Применить правило замены ${index + 1}`);
      const removeButton = createElement(root, 'button');
      removeButton.type = 'button';
      removeButton.dataset.action = 'remove';
      removeButton.textContent = 'Удалить';
      removeButton.setAttribute('aria-label', `Удалить правило замены ${index + 1}`);
      options.append(regexLabel, caseLabel, applyButton, removeButton);

      const errorOutput = createElement(root, 'p', 'rule-error');
      errorOutput.dataset.role = 'error';
      errorOutput.setAttribute('aria-live', 'polite');
      const errorId = `replacement-error-${index + 1}`;
      errorOutput.id = errorId;
      findInput.setAttribute('aria-describedby', errorId);
      replacementInput.setAttribute('aria-describedby', errorId);
      row.append(fields, options, errorOutput);
      replacementRuleList.append(row);
    });
    updateControls();
  };

  const onReplacementInput = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.field !== 'find' && input.dataset.field !== 'replacement') return;
    const row = input.closest<HTMLElement>('.replacement-rule');
    const index = Number(row?.dataset.ruleIndex);
    const rule = replaceRules[index];
    if (!rule) return;
    if (input.dataset.field === 'find') rule.find = input.value;
    else rule.replacement = input.value;
    setReplacementError(index, null);
    persistReplaceRules();
  };

  const onReplacementChange = (event: Event): void => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) return;
    if (input.dataset.field !== 'isRegex' && input.dataset.field !== 'ignoreCase') return;
    const row = input.closest<HTMLElement>('.replacement-rule');
    const index = Number(row?.dataset.ruleIndex);
    const rule = replaceRules[index];
    if (!rule) return;
    if (input.dataset.field === 'isRegex') rule.isRegex = input.checked;
    else rule.ignoreCase = input.checked;
    setReplacementError(index, null);
    persistReplaceRules();
  };

  const applySingleReplacement = (index: number): void => {
    const rule = replaceRules[index];
    if (!rule) return;
    runDeferred(replacementPanel, replacementResult, `Применяем правило замены ${index + 1}…`, async () => {
      sync.flushActive();
      const snapshotHtml = source.getHtml();
      const regexError = rule.isRegex ? validateReplaceRegex(rule) : null;
      const result = regexError
        ? { html: snapshotHtml, count: 0, error: regexError }
        : rule.isRegex
          ? await (await loadSafeReplaceModule()).applyReplaceRuleSafe(snapshotHtml, rule)
          : applyReplaceRule(snapshotHtml, rule);
      setReplacementError(index, result.error);
      if (result.error) {
        replacementResult.textContent = result.error.message;
        return;
      }
      if (!snapshotIsCurrent(snapshotHtml, replacementResult)) return;
      applyMassResult(
        snapshotHtml,
        result.html,
        `замена — правило ${index + 1}`,
        replacementCount(result.count),
        result.count === 0 ? replacementCount(0) : `Найдено совпадений: ${result.count}; документ не изменился.`,
        replacementResult,
      );
    });
  };

  const onReplacementClick = (event: Event): void => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    const button = target.closest<HTMLButtonElement>('button[data-action]');
    if (!button) return;
    const row = button.closest<HTMLElement>('.replacement-rule');
    const index = Number(row?.dataset.ruleIndex);
    if (!Number.isInteger(index) || !replaceRules[index]) return;
    if (button.dataset.action === 'apply') {
      applySingleReplacement(index);
      return;
    }
    if (button.dataset.action === 'remove') {
      replaceRules.splice(index, 1);
      const persisted = persistReplaceRules();
      renderReplaceRules();
      if (persisted) replacementResult.textContent = 'Правило удалено.';
    }
  };

  const onAddReplacement = (): void => {
    if (replaceRules.length >= MAX_REPLACE_RULES) return;
    replaceRules.push({
      id: nextReplacementId(),
      find: '',
      replacement: '',
      isRegex: false,
      ignoreCase: false,
    });
    persistReplaceRules();
    renderReplaceRules();
    const lastRow = replacementRuleList.lastElementChild;
    lastRow?.querySelector<HTMLInputElement>('[data-field="find"]')?.focus();
  };

  const onApplyAllReplacements = (): void => {
    if (replaceRules.length === 0) return;
    runDeferred(replacementPanel, replacementResult, 'Применяем правила замены…', async () => {
      sync.flushActive();
      const snapshotHtml = source.getHtml();
      const result = replaceRules.some((rule) => rule.isRegex)
        ? await (await loadSafeReplaceModule()).applyReplaceRulesSafe(snapshotHtml, replaceRules)
        : applyReplaceRules(snapshotHtml, replaceRules);
      result.results.forEach((entry) => setReplacementError(entry.ruleIndex, entry.error));
      const errorCount = result.results.filter((entry) => entry.error !== null).length;
      const suffix = errorCount > 0 ? ` Ошибок в правилах: ${errorCount}.` : '';
      if (!snapshotIsCurrent(snapshotHtml, replacementResult)) return;
      applyMassResult(
        snapshotHtml,
        result.html,
        'применение всех замен',
        `${replacementCount(result.count)}${suffix}`,
        result.count === 0
          ? `${replacementCount(0)}${suffix}`
          : `Найдено совпадений: ${result.count}; документ не изменился.${suffix}`,
        replacementResult,
      );
    });
  };

  const onCleanSelected = (): void => {
    const selected = CLEAN_RULE_IDS.filter((ruleId) => cleanCheckboxes.get(ruleId)?.checked);
    if (selected.length === 0) {
      cleaningResult.textContent = 'Выберите хотя бы одно правило очистки.';
      return;
    }
    runTransform(
      cleaningPanel,
      cleaningResult,
      'Очищаем документ…',
      'очистка выбранными правилами',
      async (html) => (await cleanHtmlCooperatively(html, selected)).html,
      `Очистка завершена: применено правил — ${selected.length}.`,
    );
  };

  const onFormat = (): void => runTransform(
    cleaningPanel,
    cleaningResult,
    'Форматируем HTML…',
    'форматирование HTML',
    formatHtml,
    'HTML отформатирован.',
  );

  const onMinify = (): void => runTransform(
    cleaningPanel,
    cleaningResult,
    'Сжимаем HTML…',
    'сжатие HTML',
    minifyHtml,
    'HTML сжат.',
  );

  const onUndo = (): void => {
    runDeferred(documentTools, undoDescription, 'Восстанавливаем документ…', () => {
      sync.flushActive();
      const result = massDocument.undo();
      if (!result) {
        renderUndoState();
        return;
      }
      renderUndoState(`Отменено: ${result.label}.`);
    });
  };

  cleanSelectedButton.addEventListener('click', onCleanSelected);
  formatButton.addEventListener('click', onFormat);
  minifyButton.addEventListener('click', onMinify);
  undoButton.addEventListener('click', onUndo);
  addReplacementButton.addEventListener('click', onAddReplacement);
  applyAllReplacementsButton.addEventListener('click', onApplyAllReplacements);
  replacementRuleList.addEventListener('input', onReplacementInput);
  replacementRuleList.addEventListener('change', onReplacementChange);
  replacementRuleList.addEventListener('click', onReplacementClick);
  cleanups.push(
    () => cleanSelectedButton.removeEventListener('click', onCleanSelected),
    () => formatButton.removeEventListener('click', onFormat),
    () => minifyButton.removeEventListener('click', onMinify),
    () => undoButton.removeEventListener('click', onUndo),
    () => addReplacementButton.removeEventListener('click', onAddReplacement),
    () => applyAllReplacementsButton.removeEventListener('click', onApplyAllReplacements),
    () => replacementRuleList.removeEventListener('input', onReplacementInput),
    () => replacementRuleList.removeEventListener('change', onReplacementChange),
    () => replacementRuleList.removeEventListener('click', onReplacementClick),
  );

  const unsubscribeUndo = massDocument.onUndoStateChange(() => renderUndoState());
  cleanups.push(unsubscribeUndo);
  renderReplaceRules();
  if (!loadedReplaceRules.ok) replacementResult.textContent = loadedReplaceRules.error.message;
  renderUndoState();

  return {
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      cleanups.forEach((cleanup) => cleanup());
      if (frameHandle !== null) {
        if (supportsAnimationFrame) view.cancelAnimationFrame(frameHandle);
        else view.clearTimeout(frameHandle);
      }
      if (timerHandle !== null) view.clearTimeout(timerHandle);
      cleaningPanel.setAttribute('aria-busy', 'false');
      replacementPanel.setAttribute('aria-busy', 'false');
      documentTools.setAttribute('aria-busy', 'false');
    },
  };
};
