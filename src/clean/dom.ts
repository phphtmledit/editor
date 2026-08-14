/*! @license GPL-2.0-or-later | https://github.com/phphtmledit/editor */

const TEXT_NODE = 3;

export const VOID_ELEMENTS = new Set([
  'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta',
  'param', 'source', 'track', 'wbr',
]);

export const PREFORMATTED_ELEMENTS = new Set([
  'code', 'kbd', 'pre', 'samp', 'script', 'style', 'textarea',
]);

export function createDetachedRoot(html: string): HTMLElement {
  if (typeof document === 'undefined') {
    throw new Error('HTML cleaning requires a browser-compatible DOM.');
  }

  const detachedDocument = document.implementation.createHTMLDocument('');
  const template = detachedDocument.createElement('template');
  template.innerHTML = html;
  detachedDocument.body.append(template.content);
  return detachedDocument.body;
}

export function allElements(root: ParentNode): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>('*'));
}

export function walkTextNodes(
  root: Node,
  visit: (textNode: Text) => void,
  skippedElements: ReadonlySet<string> = new Set(),
): void {
  for (const child of Array.from(root.childNodes)) {
    if (child.nodeType === TEXT_NODE) {
      visit(child as Text);
      continue;
    }
    if (child.nodeType !== 1) {
      continue;
    }

    const element = child as Element;
    if (!skippedElements.has(element.localName.toLowerCase())) {
      walkTextNodes(element, visit, skippedElements);
    }
  }
}

export function unwrapElement(element: Element): void {
  const parent = element.parentNode;
  if (parent === null) {
    return;
  }
  while (element.firstChild !== null) {
    parent.insertBefore(element.firstChild, element);
  }
  parent.removeChild(element);
}

export function hasMeaningfulNonTextContent(element: Element): boolean {
  return Array.from(element.querySelectorAll('*')).some((descendant) => {
    const name = descendant.localName.toLowerCase();
    return VOID_ELEMENTS.has(name) || ['audio', 'canvas', 'iframe', 'math', 'object', 'svg', 'video'].includes(name);
  });
}
