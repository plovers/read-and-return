/* Read and Return v0.1.6 */
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/main.ts
var main_exports = {};
__export(main_exports, {
  default: () => NoteNavigator
});
module.exports = __toCommonJS(main_exports);
var import_obsidian2 = require("obsidian");

// src/position.ts
var snippet = (text) => (text ?? "").trim().slice(0, 240);
var headingAt = (lines, at) => {
  let fence = "", result = { text: "", line: 0 };
  for (let i = 0; i <= at; i++) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i]);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = "";
    } else if (!fence && /^ {0,3}#{1,6}\s+/.test(lines[i])) result = { text: snippet(lines[i]), line: i };
  }
  return result;
};
function capturePosition(source, scroll, ratio) {
  const lines = source.split("\n");
  const safe = Number.isFinite(scroll) ? Math.max(0, Math.min(scroll, lines.length - 1e-6)) : 0;
  const line = Math.floor(safe);
  const heading = headingAt(lines, line);
  return {
    line,
    fraction: safe - line,
    text: snippet(lines[line]),
    before: snippet(lines[line - 1]),
    after: snippet(lines[line + 1]),
    heading: heading.text,
    headingOffset: line - heading.line,
    ratio: Number.isFinite(ratio) ? Math.max(0, Math.min(1, ratio)) : 0
  };
}
function resolvePosition(source, position) {
  const lines = source.split("\n");
  const texts = lines.map(snippet);
  let best = -1, bestScore = -Infinity;
  let fence = "", heading = "";
  let headingLine = -1, headingDistance = Infinity;
  for (let i = 0; i < texts.length; i++) {
    const marker = /^ {0,3}(`{3,}|~{3,})/.exec(lines[i]);
    if (marker) {
      if (!fence) fence = marker[1];
      else if (marker[1][0] === fence[0] && marker[1].length >= fence.length) fence = "";
    } else if (!fence && /^ {0,3}#{1,6}\s+/.test(lines[i])) {
      heading = texts[i];
      if (position.heading && heading === position.heading) {
        const distance = Math.abs(i + position.headingOffset - position.line);
        if (distance < headingDistance) {
          headingLine = i;
          headingDistance = distance;
        }
      }
    }
    const before = position.before !== "" && texts[i - 1] === position.before;
    const after = position.after !== "" && texts[i + 1] === position.after;
    if (texts[i] !== position.text || !position.text && !before && !after) continue;
    const score = (before ? 4 : 0) + (after ? 4 : 0) + (position.heading && heading === position.heading ? 6 : 0) + 1 / (1 + Math.abs(i - position.line));
    if (score > bestScore) {
      best = i;
      bestScore = score;
    }
  }
  if (best >= 0) return { line: best + position.fraction, strategy: "context" };
  if (headingLine >= 0) return {
    line: Math.min(lines.length - 1e-6, headingLine + position.headingOffset + position.fraction),
    strategy: "heading"
  };
  if (Number.isFinite(position.line) && position.line >= 0 && position.line < lines.length) {
    return { line: position.line + position.fraction, strategy: "line" };
  }
  return { line: Math.max(0, Math.min(1, position.ratio)) * (lines.length - 1), strategy: "ratio" };
}
function samePosition(a, b) {
  return a.line === b.line && Math.abs(a.fraction - b.fraction) < 0.1 && a.text === b.text && a.heading === b.heading;
}

// src/adapter.ts
var ViewAdapter = class {
  constructor(view) {
    this.view = view;
  }
  get scroller() {
    if (this.view.getMode() !== "preview") {
      return this.view.contentEl.querySelector(".cm-scroller");
    }
    const container = this.view.previewMode.containerEl;
    return container.matches(".markdown-preview-view") ? container : container.querySelector(".markdown-preview-view");
  }
  capture() {
    const el = this.scroller;
    const max = el ? el.scrollHeight - el.clientHeight : 0;
    return capturePosition(
      this.view.getViewData(),
      this.view.currentMode.getScroll(),
      el && max > 0 ? el.scrollTop / max : 0
    );
  }
  top() {
    this.view.currentMode.applyScroll(0);
  }
  atBottom() {
    const el = this.scroller;
    return el && el.clientHeight > 0 ? el.scrollHeight - el.clientHeight - el.scrollTop <= 1 : this.view.currentMode.getScroll() >= this.view.getViewData().split("\n").length;
  }
  bottom() {
    this.view.currentMode.applyScroll(this.view.getViewData().split("\n").length);
    const el = this.scroller;
    if (el) el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight);
  }
  restore(point) {
    const resolved = resolvePosition(this.view.getViewData(), point);
    if (resolved.strategy === "ratio" && this.scroller) {
      const el = this.scroller;
      el.scrollTop = point.ratio * Math.max(0, el.scrollHeight - el.clientHeight);
    } else this.view.currentMode.applyScroll(resolved.line);
    return resolved.strategy;
  }
};

// src/session.ts
var NoteSession = class {
  constructor(limit = 50) {
    this.limit = limit;
    this.back = [];
    this.forward = [];
  }
  push(stack, point) {
    if (!stack.length || !samePosition(stack[stack.length - 1], point)) stack.push(point);
    if (stack.length > this.limit) stack.splice(0, stack.length - this.limit);
  }
  depart(point) {
    this.push(this.back, point);
    this.forward.length = 0;
  }
  /** Peek first; mutate only after the adapter successfully restores the target. */
  target(direction, current) {
    return [...this[direction]].reverse().find((point) => !samePosition(point, current));
  }
  commit(direction, target, current) {
    const stack = this[direction];
    const index = stack.lastIndexOf(target);
    if (index < 0) return;
    stack.splice(index);
    this.push(direction === "back" ? this.forward : this.back, current);
  }
};
var SessionStore = class {
  constructor(limit = 100) {
    this.limit = limit;
    this.notes = /* @__PURE__ */ new Map();
  }
  get(path) {
    const note = this.notes.get(path) ?? new NoteSession();
    this.notes.delete(path);
    this.notes.set(path, note);
    if (this.notes.size > this.limit) this.notes.delete(this.notes.keys().next().value);
    return note;
  }
  rename(oldPath, newPath) {
    for (const [path, note] of [...this.notes]) {
      if (path === oldPath || path.startsWith(oldPath + "/")) {
        this.notes.delete(path);
        this.notes.set(newPath + path.slice(oldPath.length), note);
      }
    }
  }
  delete(path) {
    for (const key of this.notes.keys()) if (key === path || key.startsWith(path + "/")) this.notes.delete(key);
  }
  clear() {
    this.notes.clear();
  }
};

// src/i18n.ts
var import_obsidian = require("obsidian");
var chinese = {
  "Top / return": "\u9876\u90E8 / \u8FD4\u56DE",
  "Jump to top": "\u8DF3\u5230\u9876\u90E8\u5E76\u8BB0\u4F4F\u4F4D\u7F6E",
  "Jump to bottom": "\u8DF3\u8F6C\u5230\u5E95\u90E8",
  "Already at bottom; return point kept.": "\u5DF2\u5728\u5E95\u90E8\uFF0C\u4FDD\u7559\u539F\u8FD4\u56DE\u70B9",
  "Return to saved position": "\u8FD4\u56DE\u4E34\u65F6\u4F4D\u7F6E",
  "Set return point": "\u8BBE\u7F6E\u8FD4\u56DE\u70B9",
  "Go back": "\u4F4D\u7F6E\u540E\u9000",
  "Go forward": "\u4F4D\u7F6E\u524D\u8FDB",
  "Clear note navigation": "\u6E05\u9664\u5F53\u524D\u7B14\u8BB0\u5BFC\u822A\u8BB0\u5F55",
  "Read and Return navigation menu": "Read and Return \u5BFC\u822A\u83DC\u5355",
  "Open a Markdown note first.": "\u8BF7\u5148\u6253\u5F00 Markdown \u7B14\u8BB0",
  "Note navigation cleared.": "\u5DF2\u6E05\u9664\u5F53\u524D\u7B14\u8BB0\u7684\u5BFC\u822A\u8BB0\u5F55",
  "Return point set.": "\u5DF2\u8BBE\u7F6E\u4E34\u65F6\u8FD4\u56DE\u70B9",
  "Already at top; return point kept.": "\u5DF2\u5728\u9876\u90E8\uFF0C\u4FDD\u7559\u539F\u8FD4\u56DE\u70B9",
  "No return point.": "\u5C1A\u672A\u8BBE\u7F6E\u8FD4\u56DE\u70B9",
  "No more positions.": "\u6CA1\u6709\u66F4\u591A\u4F4D\u7F6E\u8BB0\u5F55",
  "Could not restore; retry after the note loads.": "\u6682\u65F6\u65E0\u6CD5\u6062\u590D\u4F4D\u7F6E\uFF0C\u8BF7\u7B49\u5F85\u7B14\u8BB0\u52A0\u8F7D\u540E\u91CD\u8BD5",
  "Text changed; restored an approximate position.": "\u539F\u6587\u5DF2\u53D8\u5316\uFF0C\u5DF2\u6062\u590D\u5230\u9644\u8FD1\u4F4D\u7F6E",
  "Top": "\u9876\u90E8\u5E76\u8BB0\u4F4F\u4F4D\u7F6E",
  "Return": "\u8FD4\u56DE",
  "Back": "\u540E\u9000",
  "Forward": "\u524D\u8FDB",
  "Clear this note": "\u6E05\u9664\u672C\u7BC7\u5BFC\u822A",
  "Jump to top and remember": "\u9876\u90E8\u5E76\u8BB0\u4F4F\u4F4D\u7F6E",
  "More navigation actions": "\u66F4\u591A\u5BFC\u822A\u64CD\u4F5C",
  "Navigation stays in this session; note content is never changed.": "\u5BFC\u822A\u8BB0\u5F55\u4EC5\u4FDD\u5B58\u5728\u672C\u6B21\u4F1A\u8BDD\uFF0C\u4E0D\u4FEE\u6539\u7B14\u8BB0\u6B63\u6587\u3002",
  "Mobile control": "\u79FB\u52A8\u7AEF\u60AC\u6D6E\u6309\u94AE",
  "Desktop control": "\u684C\u9762\u7AEF\u60AC\u6D6E\u6309\u94AE",
  "Side": "\u6309\u94AE\u4F4D\u7F6E",
  "Left": "\u5DE6\u4FA7",
  "Right": "\u53F3\u4FA7",
  "Bottom spacing": "\u5E95\u90E8\u8DDD\u79BB",
  "Mobile reserves at least 96px plus the safe area; increase for taller toolbars.": "\u79FB\u52A8\u7AEF\u81F3\u5C11\u9884\u7559 96px\uFF0C\u518D\u53E0\u52A0\u7CFB\u7EDF\u5B89\u5168\u533A\uFF0C\u907F\u5F00\u5E95\u90E8\u5BFC\u822A\u680F\uFF1B\u53EF\u7EE7\u7EED\u4E0A\u79FB\u3002"
};
function t(key) {
  const language = (0, import_obsidian.getLanguage)().trim().replace(/_/g, "-").toLowerCase();
  const simplified = /^(?:zh|zh-cn|zh-sg|zh-hans(?:-[a-z]{2})?)$/.test(language);
  return simplified ? chinese[key] : key;
}

// src/main.ts
var defaults = { mobileControl: true, desktopControl: false, side: "right", bottom: 24 };
var NoteNavigator = class extends import_obsidian2.Plugin {
  constructor() {
    super(...arguments);
    this.settings = { ...defaults };
    this.sessions = new SessionStore();
    this.busy = false;
    this.disposed = false;
  }
  async onload() {
    const data = await this.loadData();
    if (data?.schemaVersion === 1 && data.settings) {
      const saved = data.settings;
      this.settings = {
        mobileControl: typeof saved.mobileControl === "boolean" ? saved.mobileControl : true,
        desktopControl: typeof saved.desktopControl === "boolean" ? saved.desktopControl : false,
        side: saved.side === "left" ? "left" : "right",
        bottom: typeof saved.bottom === "number" && Number.isFinite(saved.bottom) ? Math.max(8, Math.min(160, saved.bottom)) : 24
      };
    }
    const commands = [
      ["toggle", t("Top / return"), "arrow-up"],
      ["top", t("Jump to top"), "arrow-up-to-line"],
      ["bottom", t("Jump to bottom"), "arrow-down-to-line"],
      ["return", t("Return to saved position"), "undo-2"],
      ["set", t("Set return point"), "map-pin"],
      ["back", t("Go back"), "arrow-left"],
      ["forward", t("Go forward"), "arrow-right"],
      ["clear", t("Clear note navigation"), "eraser"]
    ];
    for (const [id, name, icon] of commands) {
      this.addCommand({ id, name, icon, checkCallback: (checking) => {
        const view = this.activeView();
        if (!view?.file) return false;
        const session = this.sessions.get(view.file.path);
        const available = !this.busy && (id === "return" ? !!session.returnPoint : id === "back" || id === "forward" ? session[id].length > 0 : id === "clear" ? !!session.returnPoint || session.back.length > 0 || session.forward.length > 0 : true);
        if (available && !checking) this.run(id);
        return available;
      } });
    }
    this.ribbon = this.addRibbonIcon("navigation", t("Read and Return navigation menu"), (event) => this.menu(event));
    this.addSettingTab(new NavigatorSettings(this.app, this));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("file-open", () => this.refresh()));
    this.registerEvent(this.app.workspace.on("layout-change", () => this.refresh()));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => {
      this.sessions.rename(oldPath, file.path);
      this.refresh();
    }));
    this.registerEvent(this.app.vault.on("delete", (file) => {
      this.sessions.delete(file.path);
      this.refresh();
    }));
    this.app.workspace.onLayoutReady(() => {
      if (!this.disposed) this.refresh();
    });
  }
  activeView() {
    return this.app.workspace.getActiveViewOfType(import_obsidian2.MarkdownView);
  }
  run(action) {
    if (this.busy || this.disposed) return;
    const view = this.activeView();
    if (!view?.file) {
      new import_obsidian2.Notice(t("Open a Markdown note first."));
      return;
    }
    this.busy = true;
    try {
      const session = this.sessions.get(view.file.path);
      const adapter = new ViewAdapter(view);
      if (action === "toggle") action = session.returnPoint ? "return" : "top";
      if (action === "clear") {
        this.sessions.delete(view.file.path);
        new import_obsidian2.Notice(t("Note navigation cleared."));
        return;
      }
      const current = adapter.capture();
      if (action === "set") {
        session.returnPoint = current;
        session.depart(current);
        new import_obsidian2.Notice(t("Return point set."));
      } else if (action === "top") {
        if (current.line === 0 && current.fraction === 0) {
          new import_obsidian2.Notice(t("Already at top; return point kept."));
          return;
        }
        adapter.top();
        session.returnPoint = current;
        session.depart(current);
      } else if (action === "bottom") {
        if (adapter.atBottom()) {
          new import_obsidian2.Notice(t("Already at bottom; return point kept."));
          return;
        }
        adapter.bottom();
        session.returnPoint = current;
        session.depart(current);
      } else if (action === "return") {
        if (!session.returnPoint) {
          new import_obsidian2.Notice(t("No return point."));
          return;
        }
        this.restore(adapter, session.returnPoint);
        session.depart(current);
        session.returnPoint = void 0;
      } else {
        const target = session.target(action, current);
        if (!target) {
          new import_obsidian2.Notice(t("No more positions."));
          return;
        }
        this.restore(adapter, target);
        session.commit(action, target, current);
      }
    } catch (error) {
      console.error("Read and Return: navigation failed", error);
      new import_obsidian2.Notice(t("Could not restore; retry after the note loads."));
    } finally {
      this.busy = false;
      this.refresh();
    }
  }
  restore(adapter, point) {
    const strategy = adapter.restore(point);
    if (strategy !== "context") new import_obsidian2.Notice(t("Text changed; restored an approximate position."));
  }
  menu(event) {
    const view = this.activeView();
    if (!view?.file) {
      new import_obsidian2.Notice(t("Open a Markdown note first."));
      return;
    }
    const session = this.sessions.get(view.file.path);
    const menu = new import_obsidian2.Menu();
    const items = [
      ["top", t("Top"), "arrow-up-to-line", true],
      ["bottom", t("Jump to bottom"), "arrow-down-to-line", true],
      ["return", t("Return"), "undo-2", !!session.returnPoint],
      ["set", t("Set return point"), "map-pin", true],
      ["back", t("Back"), "arrow-left", session.back.length > 0],
      ["forward", t("Forward"), "arrow-right", session.forward.length > 0],
      ["clear", t("Clear this note"), "eraser", !!session.returnPoint || session.back.length > 0 || session.forward.length > 0]
    ];
    for (const [action, title, icon, enabled] of items) menu.addItem((item) => item.setTitle(title).setIcon(icon).setDisabled(!enabled).onClick(() => this.run(action)));
    menu.showAtMouseEvent(event);
  }
  refresh() {
    this.removeControl();
    if (this.disposed) return;
    const view = this.activeView();
    if (!view?.file || !(import_obsidian2.Platform.isMobile ? this.settings.mobileControl : this.settings.desktopControl)) return;
    this.host = view.containerEl;
    this.host.addClass("read-and-return-host");
    const control = this.host.createDiv({ cls: `read-and-return-control is-${this.settings.side}${import_obsidian2.Platform.isMobile ? " is-mobile" : ""}` });
    this.control = control;
    control.setAttribute("role", "group");
    control.setAttribute("aria-label", "Read and Return");
    control.style.setProperty("--nn-bottom", `${this.settings.bottom}px`);
    const returning = !!this.sessions.get(view.file.path).returnPoint;
    const button = control.createEl("button", { cls: "read-and-return-primary" });
    const label = returning ? t("Return to saved position") : t("Jump to top and remember");
    button.type = "button";
    button.setAttribute("aria-label", label);
    button.title = label;
    (0, import_obsidian2.setIcon)(button, returning ? "undo-2" : "arrow-up-to-line");
    button.addEventListener("click", () => this.run("toggle"));
    const more = control.createEl("button", { cls: "read-and-return-more" });
    more.type = "button";
    more.setAttribute("aria-label", t("More navigation actions"));
    more.setAttribute("aria-haspopup", "menu");
    more.title = t("More navigation actions");
    (0, import_obsidian2.setIcon)(more, "ellipsis");
    more.addEventListener("click", (event) => this.menu(event));
    control.addEventListener("pointerdown", (event) => {
      if (event.pointerType === "mouse") event.preventDefault();
    });
  }
  removeControl() {
    this.control?.remove();
    this.host?.removeClass("read-and-return-host");
    this.control = void 0;
    this.host = void 0;
  }
  async saveSettings() {
    await this.saveData({ schemaVersion: 1, settings: this.settings });
    this.refresh();
  }
  onunload() {
    this.disposed = true;
    this.removeControl();
    this.ribbon?.remove();
    this.sessions.clear();
  }
};
var NavigatorSettings = class extends import_obsidian2.PluginSettingTab {
  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }
  display() {
    this.containerEl.empty();
    new import_obsidian2.Setting(this.containerEl).setName("Read and Return").setHeading();
    this.containerEl.createEl("p", { text: t("Navigation stays in this session; note content is never changed.") });
    new import_obsidian2.Setting(this.containerEl).setName(t("Mobile control")).addToggle((toggle) => toggle.setValue(this.plugin.settings.mobileControl).onChange(async (value) => {
      this.plugin.settings.mobileControl = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(this.containerEl).setName(t("Desktop control")).addToggle((toggle) => toggle.setValue(this.plugin.settings.desktopControl).onChange(async (value) => {
      this.plugin.settings.desktopControl = value;
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(this.containerEl).setName(t("Side")).addDropdown((dropdown) => dropdown.addOption("left", t("Left")).addOption("right", t("Right")).setValue(this.plugin.settings.side).onChange(async (value) => {
      this.plugin.settings.side = value === "left" ? "left" : "right";
      await this.plugin.saveSettings();
    }));
    new import_obsidian2.Setting(this.containerEl).setName(t("Bottom spacing")).setDesc(t("Mobile reserves at least 96px plus the safe area; increase for taller toolbars.")).addSlider((slider) => slider.setLimits(import_obsidian2.Platform.isMobile ? 96 : 8, 160, 8).setValue(import_obsidian2.Platform.isMobile ? Math.max(96, this.plugin.settings.bottom) : this.plugin.settings.bottom).setDynamicTooltip().onChange(async (value) => {
      this.plugin.settings.bottom = value;
      await this.plugin.saveSettings();
    }));
  }
};
