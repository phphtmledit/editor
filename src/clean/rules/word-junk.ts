/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { allElements, unwrapElement, walkTextNodes } from '../dom';
import { BLOCK_ELEMENTS } from '../format';
import type { CleanRule } from '../types';

const COMMENT_NODE = 8;
const OFFICE_ATTRIBUTE_PATTERN = /^(?:[movwx]:|xmlns:[movwx]$)/i;
const OFFICE_CLASS_PATTERN = /^(?:mso|wordsection|spelle|grame|xl\d|outlineelement$|paragraph$|(?:normal)?textrun$|scx[a-z0-9]+$|bcx\d+$|eop$|selected$|spellingerror(?:v\d+)?themed$|listcontainerwrapper$|(?:bullet|numbered)liststyle\d+$|(?:ltr|rtl)$|underlined$)/i;
const OFFICE_DATA_ATTRIBUTE_PATTERN = /^data-(?:ccp(?:-|$)|contrast$|usefontface$|list|leveltext$|font$|aria-)/i;
const OFFICE_ELEMENT_PATTERN = /^(?:[movwx]:|xml$)/i;
const OFFICE_STANDALONE_ATTRIBUTE_PATTERN = /^(?:paraid|paraeid|aria-setsize|xml:lang)$/i;
const OFFICE_TEXT_RUN_CLASS_PATTERN = /^(?:normal)?textrun$/i;

type SemanticTag = 'em' | 'strong' | 'u';

function splitCssDeclarations(value: string): string[] {
  const declarations: string[] = [];
  let start = 0;
  let quote = '';
  let parenthesesDepth = 0;
  let escaped = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index] ?? '';
    if (escaped) {
      escaped = false;
      continue;
    }
    if (character === '\\') {
      escaped = true;
      continue;
    }
    if (quote !== '') {
      if (character === quote) {
        quote = '';
      }
      continue;
    }
    if (character === '"' || character === "'") {
      quote = character;
      continue;
    }
    if (character === '(') {
      parenthesesDepth += 1;
      continue;
    }
    if (character === ')') {
      parenthesesDepth = Math.max(0, parenthesesDepth - 1);
      continue;
    }
    if (character === ';' && parenthesesDepth === 0) {
      declarations.push(value.slice(start, index));
      start = index + 1;
    }
  }
  declarations.push(value.slice(start));
  return declarations;
}

function removeOfficeStyleDeclarations(element: HTMLElement): void {
  const style = element.getAttribute('style');
  if (style === null || !/(?:^|;)\s*mso-/i.test(style)) {
    return;
  }

  const retained = splitCssDeclarations(style)
    .map((declaration) => declaration.trim())
    .filter((declaration) => declaration !== '')
    .filter((declaration) => {
      const colon = declaration.indexOf(':');
      const propertyName = colon === -1 ? declaration : declaration.slice(0, colon);
      return !/^mso-/i.test(propertyName.trim());
    });

  if (retained.length === 0) {
    element.removeAttribute('style');
  } else {
    element.setAttribute('style', retained.join('; '));
  }
}

function hasOnlyOfficeClasses(classNames: readonly string[]): boolean {
  return classNames.length > 0 && classNames.every((className) => OFFICE_CLASS_PATTERN.test(className));
}

function isAlreadySemanticallyWrapped(element: HTMLElement, tagName: SemanticTag): boolean {
  if (element.closest(tagName) !== null) {
    return true;
  }

  const meaningfulChildren = Array.from(element.childNodes).filter((child) => (
    child.nodeType === 1 || (child.nodeType === 3 && /\S/.test(child.textContent ?? ''))
  ));
  return meaningfulChildren.length === 1 &&
    meaningfulChildren[0]?.nodeType === 1 &&
    (meaningfulChildren[0] as Element).localName.toLowerCase() === tagName;
}

function wrapContents(element: HTMLElement, tagName: SemanticTag): void {
  if (isAlreadySemanticallyWrapped(element, tagName)) {
    return;
  }

  const wrapper = element.ownerDocument.createElement(tagName);
  while (element.firstChild !== null) {
    wrapper.append(element.firstChild);
  }
  element.append(wrapper);
}

function hasBoldStyle(element: HTMLElement): boolean {
  const value = element.style.fontWeight.trim().toLowerCase();
  if (value === 'bold' || value === 'bolder') {
    return true;
  }
  return /^\d+$/.test(value) && Number(value) >= 600;
}

function promoteTextRunSemantics(element: HTMLElement): void {
  const fontStyle = element.style.fontStyle.trim().toLowerCase();
  const textDecoration = `${element.style.textDecorationLine} ${element.style.textDecoration}`.toLowerCase();
  const promoteUnderline = /\bunderline\b/.test(textDecoration) &&
    !isAlreadySemanticallyWrapped(element, 'u');
  const promoteItalic = /^(?:italic|oblique\b)/.test(fontStyle) &&
    !isAlreadySemanticallyWrapped(element, 'em');
  const promoteBold = hasBoldStyle(element) &&
    !isAlreadySemanticallyWrapped(element, 'strong');

  // Apply inside-out so combined formatting has one deterministic canonical order.
  if (promoteUnderline) {
    wrapContents(element, 'u');
  }
  if (promoteItalic) {
    wrapContents(element, 'em');
  }
  if (promoteBold) {
    wrapContents(element, 'strong');
  }
}

function normalizeTextRunSpaces(element: HTMLElement): void {
  walkTextNodes(element, (textNode) => {
    textNode.data = textNode.data.replace(/\u00a0/g, ' ');
  });

  const separatorSpans = Array.from(element.querySelectorAll('span'));
  for (let index = separatorSpans.length - 1; index >= 0; index -= 1) {
    const span = separatorSpans[index];
    if (
      span !== undefined &&
      span.parentNode !== null &&
      span.attributes.length === 0 &&
      span.children.length === 0 &&
      /^[\t\n\f\r ]+$/.test(span.textContent ?? '')
    ) {
      unwrapElement(span);
    }
  }
}

function removeConditionalComments(node: Node): void {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === COMMENT_NODE && /\[(?:if\b|endif\b)/i.test(child.textContent ?? '')) {
      child.remove();
    } else {
      removeConditionalComments(child);
    }
  }
}

function removeOfficeClasses(element: HTMLElement): void {
  if (!element.hasAttribute('class')) {
    return;
  }

  const retainedClasses = Array.from(element.classList).filter((name) => !OFFICE_CLASS_PATTERN.test(name));
  if (retainedClasses.length === 0) {
    element.removeAttribute('class');
  } else {
    element.className = retainedClasses.join(' ');
  }
}

function removeOfficeAttributes(element: HTMLElement): void {
  for (const attribute of Array.from(element.attributes)) {
    if (
      OFFICE_ATTRIBUTE_PATTERN.test(attribute.name) ||
      OFFICE_DATA_ATTRIBUTE_PATTERN.test(attribute.name) ||
      OFFICE_STANDALONE_ATTRIBUTE_PATTERN.test(attribute.name)
    ) {
      element.removeAttribute(attribute.name);
    }
  }

  removeOfficeStyleDeclarations(element);
}

function removeNestedEmptySpans(root: HTMLElement): void {
  const spans = Array.from(root.querySelectorAll('span'));
  for (let index = spans.length - 1; index >= 0; index -= 1) {
    const span = spans[index];
    if (span === undefined || span.parentNode === null) {
      continue;
    }

    const hasElementChild = span.children.length > 0;
    const hasText = /[^\t\n\f\r ]/.test(span.textContent ?? '');
    if (!hasElementChild && !hasText) {
      span.remove();
    }
  }
}

function canUnwrapOfficePresentationWrapper(element: HTMLElement): boolean {
  if (element.attributes.length > 0) {
    return false;
  }
  if (element.localName.toLowerCase() === 'span') {
    return true;
  }
  if (element.localName.toLowerCase() !== 'div') {
    return false;
  }

  return Array.from(element.childNodes).every((child) => {
    if (child.nodeType === COMMENT_NODE) {
      return true;
    }
    if (child.nodeType === 3) {
      return /^[\t\n\f\r ]*$/.test(child.textContent ?? '');
    }
    return child.nodeType === 1 && BLOCK_ELEMENTS.has((child as Element).localName.toLowerCase());
  });
}

export const wordJunkRule: CleanRule = {
  id: 'word-junk',
  label: 'Word junk',
  enabledByDefault: true,
  apply(root) {
    removeConditionalComments(root);

    for (const element of allElements(root)) {
      if (element.parentNode === null) {
        continue;
      }

      const name = element.localName.toLowerCase();
      const originalClasses = Array.from(element.classList);
      if (name === 'span' && originalClasses.some((className) => /^eop$/i.test(className))) {
        element.remove();
        continue;
      }
      if (name === 'xml') {
        element.remove();
        continue;
      }
      if (OFFICE_ELEMENT_PATTERN.test(name)) {
        unwrapElement(element);
        continue;
      }

      const isOfficeTextRun = originalClasses.some((className) => OFFICE_TEXT_RUN_CLASS_PATTERN.test(className));
      const isOfficePresentationWrapper =
        (name === 'span' || name === 'div') && hasOnlyOfficeClasses(originalClasses);
      if (isOfficeTextRun) {
        normalizeTextRunSpaces(element);
        promoteTextRunSemantics(element);
      }
      removeOfficeClasses(element);
      removeOfficeAttributes(element);
      if (isOfficePresentationWrapper) {
        element.removeAttribute('style');
        if (canUnwrapOfficePresentationWrapper(element)) {
          unwrapElement(element);
        }
      }
    }

    removeNestedEmptySpans(root);
  },
};
