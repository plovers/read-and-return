import test from 'node:test';
import assert from 'node:assert/strict';
import { capturePosition, resolvePosition } from '../src/position';
import { NoteSession, SessionStore } from '../src/session';
import { ViewAdapter } from '../src/adapter';
import type { MarkdownView } from 'obsidian';
import { longNote } from './long-note';

const source = '# Start\n\nAlpha\nBeta\nGamma\n\n## Next\nDelta';
const point = (line: number) => capturePosition(source, line, line / 8);

test('captures fractional viewport position and restores unchanged content', () => {
  const saved = capturePosition(source, 3.45, 0.4);
  assert.equal(saved.heading, '# Start');
  assert.equal(resolvePosition(source, saved).line, 3.45);
});
test('text context follows insertions and deletions above the return point', () => {
  assert.equal(resolvePosition('new\nnew\n' + source, point(3)).line, 5);
  assert.equal(resolvePosition(source.split('\n').slice(2).join('\n'), point(3)).line, 1);
});
test('repeated paragraphs choose the matching section', () => {
  const text = '# A\nsame\n\n# B\nsame\n\n# C\nsame';
  const saved = capturePosition(text, 4, 0.5);
  const edited = 'inserted\n'.repeat(30) + text;
  assert.equal(resolvePosition(edited, saved).line, 34);
});
test('blank lines use adjacent context', () => {
  assert.equal(resolvePosition('new\n' + source, point(5)).line, 6);
});
test('deleted text falls back to heading, line, then ratio', () => {
  assert.equal(resolvePosition(source.replace('Beta', 'Rewritten'), point(3)).strategy, 'heading');
  assert.equal(resolvePosition('one\ntwo\nthree\nfour', { ...point(3), heading: '' }).strategy, 'line');
  const resolved = resolvePosition('one\ntwo', { ...point(7), heading: '', ratio: 0.5 });
  assert.deepEqual(resolved, { line: 0.5, strategy: 'ratio' });
});
test('empty note and invalid host coordinates are safe', () => {
  const saved = capturePosition('', NaN, Infinity);
  assert.equal(saved.line, 0);
  assert.equal(saved.ratio, 0);
  assert.equal(resolvePosition('', saved).line, 0);
});
test('preserves a fractional position within a wrapped final source line', () => {
  const text = 'A very long paragraph '.repeat(1000);
  const saved = capturePosition(text, 0.75, 0.8);
  assert.equal(saved.fraction, 0.75);
  assert.equal(resolvePosition(text, saved).line, 0.75);
});
test('fenced code heading is ignored', () => {
  const saved = capturePosition('# Real\n```\n# Fake\n```\nHere', 4, 1);
  assert.equal(saved.heading, '# Real');
});
test('history supports back/forward and clears a forward branch on new navigation', () => {
  const session = new NoteSession();
  session.depart(point(2));
  session.depart(point(3));
  const target = session.target('back', point(4))!;
  assert.equal(target.line, 3);
  session.commit('back', target, point(4));
  assert.equal(session.target('back', point(3))?.line, 2);
  assert.equal(session.target('forward', point(3))?.line, 4);
  session.commit('forward', session.target('forward', point(3))!, point(3));
  assert.equal(session.target('back', point(4))?.line, 3);
  session.commit('back', session.target('back', point(4))!, point(4));
  session.depart(point(5));
  assert.equal(session.forward.length, 0);
});
test('history skips same position, stays bounded, and peek does not consume state', () => {
  const session = new NoteSession(2);
  session.depart(point(1)); session.depart(point(2)); session.depart(point(3)); session.depart(point(3));
  assert.equal(session.back.length, 2);
  assert.equal(session.target('back', point(3))?.line, 2);
  assert.equal(session.back.length, 2);
});
test('rename and folder deletion migrate or remove all relevant sessions', () => {
  const store = new SessionStore();
  const a = store.get('folder/a.md');
  const b = store.get('folder/b.md');
  const other = store.get('folder-extra/a.md');
  a.returnPoint = point(3);
  store.rename('folder', 'new');
  assert.equal(store.get('new/a.md'), a);
  assert.equal(store.get('new/b.md'), b);
  store.delete('new');
  assert.notEqual(store.get('new/a.md'), a);
  assert.equal(store.get('folder-extra/a.md'), other);
});
test('session count is bounded with least-recently-used eviction', () => {
  const store = new SessionStore(2);
  const a = store.get('a'); const b = store.get('b');
  store.get('a'); store.get('c');
  assert.equal(store.get('a'), a);
  assert.notEqual(store.get('b'), b);
});

for (const mode of ['preview', 'source'] as const) {
  test(`${mode} adapter uses viewport coordinates, preserves content and avoids editor focus`, () => {
    let scroll = 3.25;
    let content = source;
    const el = { scrollTop: 400, scrollHeight: 1000, clientHeight: 200,
      matches: (selector: string) => selector === '.markdown-preview-view' };
    const view = {
      getMode: () => mode,
      getViewData: () => content,
      previewMode: { containerEl: el },
      contentEl: { querySelector: () => el },
      currentMode: { getScroll: () => scroll, applyScroll: (value: number) => { scroll = value; } }
    } as unknown as MarkdownView;
    const adapter = new ViewAdapter(view);
    const saved = adapter.capture();
    adapter.top(); assert.equal(scroll, 0);
    content = 'Wrapped final paragraph '.repeat(1000);
    assert.equal(adapter.atBottom(), false);
    adapter.bottom();
    assert.equal(scroll, 1);
    assert.equal(el.scrollTop, 800);
    assert.equal(adapter.atBottom(), true);
    content = 'inserted\n' + source;
    adapter.restore(saved); assert.equal(scroll, 4.25);
    assert.equal(content, 'inserted\n' + source);
  });
}
test('reading wrapper uses inner viewport for bottom, capture and ratio restoration', () => {
  const inner = { scrollTop: 400, scrollHeight: 1000, clientHeight: 200 };
  const wrapper = { scrollTop: 0, scrollHeight: 200, clientHeight: 200,
    matches: () => false, querySelector: () => inner };
  let scroll = 3.25;
  const view = {
    getMode: () => 'preview', getViewData: () => source,
    previewMode: { containerEl: wrapper },
    currentMode: { getScroll: () => scroll, applyScroll: (value: number) => { scroll = value; } }
  } as unknown as MarkdownView;
  const adapter = new ViewAdapter(view);
  assert.equal(adapter.capture().ratio, 0.5);
  assert.equal(adapter.atBottom(), false);
  adapter.bottom();
  assert.equal(scroll, source.split('\n').length);
  assert.equal(inner.scrollTop, 800);
  assert.equal(wrapper.scrollTop, 0);
  assert.equal(adapter.atBottom(), true);
  const stale = { ...point(3), line: 1000, text: 'missing', before: '', after: '', heading: '', ratio: 0.25 };
  assert.equal(adapter.restore(stale), 'ratio');
  assert.equal(inner.scrollTop, 200);
});

for (const mode of ['preview', 'source']) {
  for (const state of ['missing', 'unlaid-out']) {
    test(`${mode}: ${state} scroller cannot suppress a bottom jump`, () => {
      const el = state === 'missing' ? null : { scrollTop: 0, scrollHeight: 0, clientHeight: 0 };
      let scroll = 3;
      const view = {
        getMode: () => mode, getViewData: () => source,
        previewMode: { containerEl: { matches: () => false, querySelector: () => el } },
        contentEl: { querySelector: () => el },
        currentMode: { getScroll: () => scroll, applyScroll: (value: number) => { scroll = value; } }
      } as unknown as MarkdownView;
      const adapter = new ViewAdapter(view);
      assert.equal(adapter.atBottom(), false);
      adapter.bottom();
      assert.equal(scroll, source.split('\n').length);
    });
  }
}

test('large Markdown note restores a late viewport after edits without changing the source', () => {
  const text = longNote();
  assert.ok(Buffer.byteLength(text) > 2_000_000);
  const lines = text.split('\n');
  assert.ok(lines.length > 50_000);
  const line = lines.findIndex(value => value.startsWith('唯一定位段落 2700：'));
  assert.ok(line > 50_000);
  const saved = capturePosition(text, line + 0.35, 0.9);
  const edited = '# 新增前言\n\n说明\n\n' + text;
  const start = performance.now();
  const result = resolvePosition(edited, saved);
  assert.equal(result.line, line + 4.35);
  assert.equal(result.strategy, 'context');
  console.log(`Long note: ${lines.length} lines, ${Buffer.byteLength(text)} bytes; restore ${Math.round(performance.now() - start)} ms`);
});
