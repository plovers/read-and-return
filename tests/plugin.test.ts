import test from 'node:test';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import vm from 'node:vm';
import { longNote } from './long-note';

// Bundle the actual entrypoint and exercise host-facing commands with a read-only host double.
const compiled = await build({ entryPoints: ['src/main.ts'], bundle: true, external: ['obsidian'],
  format: 'cjs', platform: 'browser', write: false });

async function harness(savedData: unknown = null, language = 'en') {
  const messages: string[] = [];
  const labels: string[] = [];
  const element = (): any => ({
    addClass() {}, removeClass() {}, remove() {}, empty() {}, addEventListener() {},
    style: { setProperty() {} },
    setAttribute(name: string, value: string) { if (name === 'aria-label') labels.push(value); },
    createDiv() { return element(); },
    createEl(_tag: string, options?: { text?: string }) {
      if (options?.text) labels.push(options.text);
      return element();
    }
  });
  const menuItems: any[] = [];
  const events = new Map<string, (...args: any[]) => void>();
  let scroll = 4.25;
  let source = '# Test\n\nA\nB\nC\nD\nE';
  let active: any;
  const scroller = { scrollTop: 425, scrollHeight: 1000, clientHeight: 200 };
  const view = {
    containerEl: element(),
    file: { path: 'note.md' },
    getMode: () => 'preview',
    getViewData: () => source,
    previewMode: { containerEl: { scrollTop: 0, scrollHeight: 200, clientHeight: 200,
      matches: () => false,
      querySelector: (selector: string) => { assert.equal(selector, '.markdown-preview-view'); return scroller; } } },
    currentMode: { getScroll: () => scroll, applyScroll: (value: number) => { scroll = value; } }
  };
  active = view;
  const on = (name: string, callback: (...args: any[]) => void) => { events.set(name, callback); return {}; };
  class Plugin {
    app = { workspace: { getActiveViewOfType: () => active, on, onLayoutReady: (cb: () => void) => cb() }, vault: { on } };
    commands: any[] = [];
    async loadData() { return savedData; }
    addCommand(command: any) { this.commands.push(command); }
    addRibbonIcon(_icon: string, title: string) { labels.push(title); return { remove() {} }; }
    addSettingTab(tab: any) { tab.display(); }
    registerEvent() {}
  }
  const module = { exports: {} as any };
  const widget: any = { setValue() { return this; }, onChange() { return this; },
    setLimits() { return this; }, setDynamicTooltip() { return this; },
    addOption(_key: string, label: string) { labels.push(label); return this; } };
  const host = { Plugin, PluginSettingTab: class { containerEl = element(); }, MarkdownView: class {}, Platform: { isMobile: false },
    setIcon() {},
    Setting: class {
      setName(value: string) { labels.push(value); return this; }
      setDesc(value: string) { labels.push(value); return this; }
      addToggle(cb: any) { cb(widget); return this; }
      addDropdown(cb: any) { cb(widget); return this; }
      addSlider(cb: any) { cb(widget); return this; }
    },
    getLanguage: () => language,
    Menu: class {
      constructor() { menuItems.length = 0; }
      addItem(callback: (item: any) => void) {
        const item = {
          title: '', icon: '', disabled: false,
          setTitle(value: string) { this.title = value; return this; },
          setIcon(value: string) { this.icon = value; return this; },
          setDisabled(value: boolean) { this.disabled = value; return this; },
          onClick(callback: () => void) { (this as any).click = callback; return this; }
        };
        callback(item); menuItems.push(item);
      }
      showAtMouseEvent() {}
    },
    Notice: class { constructor(text: string) { messages.push(text); } } };
  vm.runInNewContext(compiled.outputFiles[0].text, { module, exports: module.exports,
    require: (name: string) => { assert.equal(name, 'obsidian'); return host; }, console });
  const plugin = new module.exports.default();
  await plugin.onload();
  return { plugin, messages, labels, menuItems, events, view, scroller, getScroll: () => scroll,
    setScroll: (value: number) => { scroll = value; },
    setSource: (value: string) => { source = value; },
    setActive: (value: any) => { active = value; } };
}

test('entrypoint: top saves viewport, repeat top preserves it, return consumes point', async () => {
  const h = await harness();
  assert.equal(h.plugin.commands.length, 8);
  h.plugin.run('top'); assert.equal(h.getScroll(), 0);
  assert.equal(h.plugin.sessions.get('note.md').returnPoint.line, 4);
  h.plugin.run('top');
  assert.equal(h.plugin.sessions.get('note.md').returnPoint.line, 4);
  h.plugin.run('return'); assert.equal(h.getScroll(), 4.25);
  assert.equal(h.plugin.sessions.get('note.md').returnPoint, undefined);
  h.plugin.run('back'); assert.equal(h.getScroll(), 0);
  h.plugin.run('forward'); assert.equal(h.getScroll(), 4.25);
});

test('menu availability follows return point and history, including clear', async () => {
  const h = await harness();
  const disabled = () => {
    h.plugin.menu({});
    return h.menuItems.map(item => item.disabled);
  };
  const clear = h.plugin.commands.find((command: any) => command.id === 'clear');
  assert.deepEqual(disabled(), [false, false, true, false, true, true, true]);
  assert.equal(clear.checkCallback(true), false);
  h.plugin.run('top');
  assert.deepEqual(disabled(), [false, false, false, false, false, true, false]);
  assert.equal(clear.checkCallback(true), true);
  h.plugin.run('return');
  assert.deepEqual(disabled(), [false, false, true, false, false, true, false]);
  h.plugin.run('back');
  assert.equal(disabled()[5], false);
  h.plugin.run('clear');
  assert.deepEqual(disabled(), [false, false, true, false, true, true, true]);
});

test('app language selects single-language labels and notices with English fallback', async () => {
  for (const language of ['zh', 'zh-CN', 'zh_SG', 'ZH-hans', 'zh-Hans-CN', 'en', 'de', 'ja', 'zh-TW', 'zh_HK', 'zh-MO', 'zh-Hant', 'zh-Hant-CN', '', 'unknown']) {
    const h = await harness(null, language);
    const chinese = ['zh', 'zh-CN', 'zh_SG', 'ZH-hans', 'zh-Hans-CN'].includes(language);
    h.plugin.settings.desktopControl = true;
    h.plugin.refresh();
    assert.ok(h.labels.includes(chinese ? '移动端悬浮按钮' : 'Mobile control'));
    assert.ok(h.labels.includes(chinese ? '更多导航操作' : 'More navigation actions'));
    assert.ok(h.labels.includes(chinese ? 'Read and Return 导航菜单' : 'Read and Return navigation menu'));
    if (!chinese) assert.ok(h.labels.every(label => !/\p{Script=Han}/u.test(label)));
    h.plugin.menu({});
    assert.equal(h.menuItems[0].title, chinese ? '顶部并记住位置' : 'Top');
    assert.equal(h.menuItems[2].title, chinese ? '返回' : 'Return');
    assert.equal(h.menuItems[1].title, chinese ? '跳转到底部' : 'Jump to bottom');
    assert.equal(h.menuItems[1].icon, 'arrow-down-to-line');
    assert.equal(h.menuItems[0].icon, 'arrow-up-to-line');
    assert.ok(h.menuItems.every(item => !/[↑↩←→]/.test(item.title)));
    assert.equal(h.plugin.commands[1].name, chinese ? '跳到顶部并记住位置' : 'Jump to top');
    h.plugin.run('set');
    assert.equal(h.messages.at(-1), chinese ? '已设置临时返回点' : 'Return point set.');
    h.plugin.run('clear');
    assert.equal(h.messages.at(-1), chinese ? '已清除当前笔记的导航记录' : 'Note navigation cleared.');
    h.plugin.run('return');
    assert.equal(h.messages.at(-1), chinese ? '尚未设置返回点' : 'No return point.');
    h.plugin.run('back');
    assert.equal(h.messages.at(-1), chinese ? '没有更多位置记录' : 'No more positions.');
    h.setActive(null);
    h.plugin.run('top');
    assert.equal(h.messages.at(-1), chinese ? '请先打开 Markdown 笔记' : 'Open a Markdown note first.');
  }
});
test('entrypoint: explicit return point follows edited content and toggle returns', async () => {
  const h = await harness();
  h.plugin.run('set');
  h.setSource('New\n# Test\n\nA\nB\nC\nD\nE');
  h.setScroll(1);
  h.plugin.run('toggle');
  assert.equal(h.getScroll(), 5.25);
});

test('bottom menu navigates a long note, preserves repeated return point and supports history', async () => {
  const h = await harness();
  const text = longNote();
  h.setSource(text);
  h.setScroll(60000.25);
  h.plugin.menu({});
  h.menuItems[1].click();
  assert.equal(h.getScroll(), text.split('\n').length);
  assert.equal(h.scroller.scrollTop, 800);
  const session = h.plugin.sessions.get('note.md');
  const saved = session.returnPoint;
  assert.equal(saved.line, 60000);
  h.plugin.run('bottom');
  assert.equal(session.returnPoint, saved);
  assert.equal(session.back.length, 1);
  h.plugin.run('toggle');
  assert.equal(h.getScroll(), 60000.25);
  assert.equal(session.returnPoint, undefined);
  h.plugin.run('back');
  assert.ok(h.getScroll() >= text.split('\n').length - 1);
  assert.equal(h.view.getViewData(), text);
});

test('bottom on an empty or non-scrolling note preserves state', async () => {
  for (const text of ['', 'Short note']) {
    const h = await harness();
    h.setSource(text);
    h.setScroll(0);
    h.scroller.scrollHeight = 200;
    h.scroller.scrollTop = 0;
    h.plugin.run('set');
    const session = h.plugin.sessions.get('note.md');
    const saved = session.returnPoint;
    const count = session.back.length;
    h.plugin.run('bottom');
    assert.equal(session.returnPoint, saved);
    assert.equal(session.back.length, count);
    assert.equal(h.getScroll(), 0);
  }
});

test('failed bottom jump keeps existing return point and history', async () => {
  const h = await harness();
  h.plugin.run('set');
  const session = h.plugin.sessions.get('note.md');
  const saved = session.returnPoint;
  h.setScroll(2);
  h.view.currentMode.applyScroll = () => { throw new Error('Host loading'); };
  h.plugin.run('bottom');
  assert.equal(session.returnPoint, saved);
  assert.equal(session.back.length, 1);
  assert.match(h.messages.at(-1)!, /Could not restore/);
});
test('entrypoint: failed restore retains return point and history', async () => {
  const h = await harness();
  h.plugin.run('top');
  h.view.currentMode.applyScroll = () => { throw new Error('Host loading'); };
  h.plugin.run('return');
  assert.ok(h.plugin.sessions.get('note.md').returnPoint);
  assert.equal(h.plugin.sessions.get('note.md').back.length, 1);
  assert.match(h.messages.at(-1)!, /Could not restore/);
});
test('entrypoint: rename migrates, delete clears, and unload clears session state', async () => {
  const h = await harness();
  h.plugin.run('set');
  h.view.file.path = 'renamed.md';
  h.events.get('rename')!(h.view.file, 'note.md');
  assert.ok(h.plugin.sessions.get('renamed.md').returnPoint);
  h.events.get('delete')!(h.view.file);
  assert.equal(h.plugin.sessions.get('renamed.md').returnPoint, undefined);
  h.plugin.run('set');
  h.plugin.onunload();
  assert.equal(h.plugin.sessions.get('renamed.md').returnPoint, undefined);
});
test('entrypoint: non-Markdown command checks are disabled and unknown settings schema is safe', async () => {
  const h = await harness({ schemaVersion: 99, settings: { desktopControl: true, bottom: -500 } });
  assert.equal(h.plugin.settings.desktopControl, false);
  assert.equal(h.plugin.settings.bottom, 24);
  h.setActive(null);
  assert.ok(h.plugin.commands.every((command: any) => command.checkCallback(true) === false));
  h.plugin.run('top');
  assert.match(h.messages.at(-1)!, /Open a Markdown note/);
});
