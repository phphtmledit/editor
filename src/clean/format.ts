/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

import { createDetachedRoot, PREFORMATTED_ELEMENTS, VOID_ELEMENTS } from './dom';

export const BLOCK_ELEMENTS = new Set([
  'address', 'article', 'aside', 'blockquote', 'dd', 'details', 'dialog', 'div',
  'dl', 'dt', 'fieldset', 'figcaption', 'figure', 'footer', 'form', 'h1', 'h2',
  'h3', 'h4', 'h5', 'h6', 'header', 'hgroup', 'hr', 'li', 'main', 'nav', 'ol',
  'p', 'pre', 'section', 'summary', 'table', 'tbody', 'td', 'tfoot', 'th',
  'thead', 'tr', 'ul',
]);

function escapeText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeAttribute(value: string): string {
  return escapeText(value).replace(/"/g, '&quot;');
}

function openingTag(element: Element): string {
  const attributes = Array.from(element.attributes)
    .map((attribute) => ` ${attribute.name}="${escapeAttribute(attribute.value)}"`)
    .join('');
  return `<${element.localName}${attributes}>`;
}

function normalizeTextLineBreaks(value: string): string {
  return value.replace(/[\t ]*[\r\n]+[\t ]*/g, ' ');
}

function serializeCompact(node: Node, normalizeLineBreaks = false): string {
  if (node.nodeType === 3) {
    const text = node.textContent ?? '';
    return escapeText(normalizeLineBreaks ? normalizeTextLineBreaks(text) : text);
  }
  if (node.nodeType === 8) {
    return `<!--${node.textContent ?? ''}-->`;
  }
  if (node.nodeType !== 1) {
    return '';
  }

  const element = node as Element;
  const name = element.localName.toLowerCase();
  const open = openingTag(element);
  if (VOID_ELEMENTS.has(name)) {
    return open;
  }
  return `${open}${Array.from(element.childNodes)
    .map((child) => serializeCompact(child, normalizeLineBreaks))
    .join('')}</${element.localName}>`;
}

function indentation(depth: number): string {
  return '  '.repeat(depth);
}

function isBlockNode(node: Node): node is Element {
  return node.nodeType === 1 && BLOCK_ELEMENTS.has((node as Element).localName.toLowerCase());
}

function serializePrettyElement(element: Element, depth: number): string {
  const name = element.localName.toLowerCase();
  const prefix = indentation(depth);
  const open = openingTag(element);
  if (VOID_ELEMENTS.has(name)) {
    return `${prefix}${open}`;
  }
  if (PREFORMATTED_ELEMENTS.has(name)) {
    return `${prefix}${open}${element.innerHTML}</${element.localName}>`;
  }

  const children = Array.from(element.childNodes);
  if (!children.some(isBlockNode)) {
    return `${prefix}${open}${children.map((child) => serializeCompact(child, true)).join('')}</${element.localName}>`;
  }

  const lines = [`${prefix}${open}`];
  let inlineGroup = '';
  const flushInlineGroup = (): void => {
    if (/^[\t\n\f\r ]*$/.test(inlineGroup)) {
      inlineGroup = '';
      return;
    }
    lines.push(`${indentation(depth + 1)}${inlineGroup}`);
    inlineGroup = '';
  };

  for (const child of children) {
    if (isBlockNode(child)) {
      flushInlineGroup();
      lines.push(serializePrettyElement(child, depth + 1));
    } else {
      inlineGroup += serializeCompact(child, true);
    }
  }
  flushInlineGroup();
  lines.push(`${prefix}</${element.localName}>`);
  return lines.join('\n');
}

export function formatHtml(html: string): string {
  const root = createDetachedRoot(html);
  const lines: string[] = [];
  let inlineGroup = '';

  const flushInlineGroup = (): void => {
    if (/^[\t\n\f\r ]*$/.test(inlineGroup)) {
      inlineGroup = '';
      return;
    }
    lines.push(inlineGroup);
    inlineGroup = '';
  };

  for (const child of Array.from(root.childNodes)) {
    if (isBlockNode(child)) {
      flushInlineGroup();
      lines.push(serializePrettyElement(child, 0));
    } else {
      inlineGroup += serializeCompact(child, true);
    }
  }
  flushInlineGroup();
  return lines.join('\n');
}
