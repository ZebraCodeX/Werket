/**
 * Selection utilities for saving/restoring caret position in contenteditable
 */

export interface SelectionOffsets {
  start: number;
  end: number;
}

export function getSelectionOffsets(editor: HTMLElement): SelectionOffsets {
  const sel = window.getSelection();
  if (!sel || !sel.rangeCount || !editor.contains(sel.anchorNode)) {
    return { start: 0, end: 0 };
  }
  const range = sel.getRangeAt(0);
  return {
    start: getTextOffset(editor, range.startContainer, range.startOffset),
    end: getTextOffset(editor, range.endContainer, range.endOffset),
  };
}

function getTextOffset(root: HTMLElement, node: Node, offset: number): number {
  let count = 0;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let currentNode: Node | null;
  while ((currentNode = walker.nextNode())) {
    if (currentNode === node) {
      return count + Math.min(offset, currentNode.nodeValue?.length || 0);
    }
    count += currentNode.nodeValue?.length || 0;
  }
  return count;
}

export function restoreSelection(editor: HTMLElement, start: number, end: number): void {
  const sel = window.getSelection();
  if (!sel) return;

  const range = document.createRange();
  const startPoint = getNodeAtOffset(editor, start);
  const endPoint = getNodeAtOffset(editor, end);

  try {
    range.setStart(startPoint.node, startPoint.offset);
    range.setEnd(endPoint.node, endPoint.offset);
    sel.removeAllRanges();
    sel.addRange(range);
  } catch {
    // Fallback: place cursor at end of editor
    range.selectNodeContents(editor);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
  }
}

function getNodeAtOffset(root: HTMLElement, offset: number): { node: Node; offset: number } {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let count = 0;
  let currentNode: Node | null;
  while ((currentNode = walker.nextNode())) {
    const len = currentNode.nodeValue?.length || 0;
    if (count + len >= offset) {
      return { node: currentNode, offset: Math.max(0, offset - count) };
    }
    count += len;
  }
  // If offset is past all text, return end of last text node or root
  const lastNode = walker.currentNode;
  if (lastNode && lastNode.nodeType === Node.TEXT_NODE) {
    return { node: lastNode, offset: lastNode.nodeValue?.length || 0 };
  }
  return { node: root, offset: 0 };
}

export function saveSelection(editor: HTMLElement): SelectionOffsets {
  return getSelectionOffsets(editor);
}

export function replaceSpellSpan(element: HTMLElement, replacement: string): void {
  const text = document.createTextNode(replacement);
  element.parentNode?.replaceChild(text, element);
  // Normalize to merge adjacent text nodes
  element.parentNode?.normalize();
}