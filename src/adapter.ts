import type { MarkdownView } from 'obsidian';
import { capturePosition, resolvePosition, type Position } from './position';

/** Keep host integration separate from position matching and navigation history. */
export class ViewAdapter {
  constructor(readonly view: MarkdownView) {}

  private get scroller(): HTMLElement | null {
    if (this.view.getMode() !== 'preview') {
      return this.view.contentEl.querySelector<HTMLElement>('.cm-scroller');
    }
    // containerEl may be a non-scrolling wrapper around the actual reading viewport.
    const container = this.view.previewMode.containerEl;
    return container.matches('.markdown-preview-view') ? container
      : container.querySelector<HTMLElement>('.markdown-preview-view');
  }

  capture(): Position {
    const el = this.scroller;
    const max = el ? el.scrollHeight - el.clientHeight : 0;
    return capturePosition(this.view.getViewData(), this.view.currentMode.getScroll(),
      el && max > 0 ? el.scrollTop / max : 0);
  }

  top() { this.view.currentMode.applyScroll(0); }

  atBottom(): boolean {
    const el = this.scroller;
    // Missing/hidden viewports provide no evidence that the note is already at its end.
    return el && el.clientHeight > 0 ? el.scrollHeight - el.clientHeight - el.scrollTop <= 1
      : this.view.currentMode.getScroll() >= this.view.getViewData().split('\n').length;
  }

  bottom() {
    // Target the end boundary, including a wrapped final line, through the host API.
    this.view.currentMode.applyScroll(this.view.getViewData().split('\n').length);
    const el = this.scroller;
    if (el) el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  }

  restore(point: Position): 'context' | 'heading' | 'line' | 'ratio' {
    const resolved = resolvePosition(this.view.getViewData(), point);
    if (resolved.strategy === 'ratio' && this.scroller) {
      const el = this.scroller;
      el.scrollTop = point.ratio * Math.max(0, el.scrollHeight - el.clientHeight);
    } else this.view.currentMode.applyScroll(resolved.line);
    return resolved.strategy;
  }
}
