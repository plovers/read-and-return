import { App, MarkdownView, Menu, Notice, Platform, Plugin, PluginSettingTab, Setting, setIcon } from 'obsidian';
import { ViewAdapter } from './adapter';
import { SessionStore } from './session';
import { t } from './i18n';

type Action = 'toggle' | 'top' | 'bottom' | 'return' | 'set' | 'back' | 'forward' | 'clear';
interface Settings { mobileControl: boolean; desktopControl: boolean; side: 'left' | 'right'; bottom: number }
const defaults: Settings = { mobileControl: true, desktopControl: false, side: 'right', bottom: 24 };

export default class NoteNavigator extends Plugin {
  settings: Settings = { ...defaults };
  readonly sessions = new SessionStore();
  private control?: HTMLElement;
  private host?: HTMLElement;
  private busy = false;
  private disposed = false;
  private ribbon?: HTMLElement;

  async onload() {
    const data = await this.loadData();
    // Only preferences are persisted. Unknown schema versions use safe defaults.
    if (data?.schemaVersion === 1 && data.settings) {
      const saved = data.settings;
      this.settings = {
        mobileControl: typeof saved.mobileControl === 'boolean' ? saved.mobileControl : true,
        desktopControl: typeof saved.desktopControl === 'boolean' ? saved.desktopControl : false,
        side: saved.side === 'left' ? 'left' : 'right',
        bottom: typeof saved.bottom === 'number' && Number.isFinite(saved.bottom)
          ? Math.max(8, Math.min(160, saved.bottom)) : 24
      };
    }
    const commands: [Action, string, string][] = [
      ['toggle', t("Top / return"), 'arrow-up'],
      ['top', t("Jump to top"), 'arrow-up-to-line'],
      ['bottom', t("Jump to bottom"), 'arrow-down-to-line'],
      ['return', t("Return to saved position"), 'undo-2'],
      ['set', t("Set return point"), 'map-pin'],
      ['back', t("Go back"), 'arrow-left'],
      ['forward', t("Go forward"), 'arrow-right'],
      ['clear', t("Clear note navigation"), 'eraser']
    ];
    for (const [id, name, icon] of commands) {
      this.addCommand({ id, name, icon, checkCallback: checking => {
        const view = this.activeView();
        if (!view?.file) return false;
        const session = this.sessions.get(view.file.path);
        const available = !this.busy && (id === 'return' ? !!session.returnPoint :
          id === 'back' || id === 'forward' ? session[id].length > 0 :
          id === 'clear' ? !!session.returnPoint || session.back.length > 0 || session.forward.length > 0 : true);
        if (available && !checking) this.run(id);
        return available;
      } });
    }
    this.ribbon = this.addRibbonIcon('navigation', t("Read and Return navigation menu"), event => this.menu(event));
    this.addSettingTab(new NavigatorSettings(this.app, this));
    this.registerEvent(this.app.workspace.on('active-leaf-change', () => this.refresh()));
    this.registerEvent(this.app.workspace.on('file-open', () => this.refresh()));
    this.registerEvent(this.app.workspace.on('layout-change', () => this.refresh()));
    this.registerEvent(this.app.vault.on('rename', (file, oldPath) => {
      this.sessions.rename(oldPath, file.path);
      this.refresh();
    }));
    this.registerEvent(this.app.vault.on('delete', file => {
      this.sessions.delete(file.path);
      this.refresh();
    }));
    this.app.workspace.onLayoutReady(() => { if (!this.disposed) this.refresh(); });
  }

  activeView(): MarkdownView | null { return this.app.workspace.getActiveViewOfType(MarkdownView); }

  run(action: Action) {
    if (this.busy || this.disposed) return;
    const view = this.activeView();
    if (!view?.file) { new Notice(t("Open a Markdown note first.")); return; }
    this.busy = true;
    try {
      const session = this.sessions.get(view.file.path);
      const adapter = new ViewAdapter(view);
      if (action === 'toggle') action = session.returnPoint ? 'return' : 'top';
      if (action === 'clear') {
        this.sessions.delete(view.file.path);
        new Notice(t("Note navigation cleared."));
        return;
      }
      const current = adapter.capture();
      if (action === 'set') {
        session.returnPoint = current;
        session.depart(current);
        new Notice(t("Return point set."));
      } else if (action === 'top') {
        if (current.line === 0 && current.fraction === 0) {
          new Notice(t("Already at top; return point kept."));
          return;
        }
        adapter.top();
        session.returnPoint = current;
        session.depart(current);
      } else if (action === 'bottom') {
        if (adapter.atBottom()) {
          new Notice(t("Already at bottom; return point kept."));
          return;
        }
        adapter.bottom();
        session.returnPoint = current;
        session.depart(current);
      } else if (action === 'return') {
        if (!session.returnPoint) { new Notice(t("No return point.")); return; }
        this.restore(adapter, session.returnPoint);
        session.depart(current);
        session.returnPoint = undefined;
      } else {
        const target = session.target(action, current);
        if (!target) { new Notice(t("No more positions.")); return; }
        this.restore(adapter, target);
        session.commit(action, target, current);
      }
    } catch (error) {
      console.error('Read and Return: navigation failed', error);
      new Notice(t("Could not restore; retry after the note loads."));
    } finally {
      this.busy = false;
      this.refresh();
    }
  }

  private restore(adapter: ViewAdapter, point: Parameters<ViewAdapter['restore']>[0]) {
    const strategy = adapter.restore(point);
    if (strategy !== 'context') new Notice(t("Text changed; restored an approximate position."));
  }

  menu(event: MouseEvent) {
    const view = this.activeView();
    if (!view?.file) { new Notice(t("Open a Markdown note first.")); return; }
    const session = this.sessions.get(view.file.path);
    const menu = new Menu();
    const items: [Action, string, string, boolean][] = [
      ['top', t("Top"), 'arrow-up-to-line', true],
      ['bottom', t("Jump to bottom"), 'arrow-down-to-line', true],
      ['return', t("Return"), 'undo-2', !!session.returnPoint],
      ['set', t("Set return point"), 'map-pin', true],
      ['back', t("Back"), 'arrow-left', session.back.length > 0],
      ['forward', t("Forward"), 'arrow-right', session.forward.length > 0],
      ['clear', t("Clear this note"), 'eraser', !!session.returnPoint || session.back.length > 0 || session.forward.length > 0]
    ];
    for (const [action, title, icon, enabled] of items) menu.addItem(item =>
      item.setTitle(title).setIcon(icon).setDisabled(!enabled).onClick(() => this.run(action)));
    menu.showAtMouseEvent(event);
  }

  refresh() {
    this.removeControl();
    if (this.disposed) return;
    const view = this.activeView();
    if (!view?.file || !(Platform.isMobile ? this.settings.mobileControl : this.settings.desktopControl)) return;
    this.host = view.containerEl;
    this.host.addClass('read-and-return-host');
    const control = this.host.createDiv({ cls: `read-and-return-control is-${this.settings.side}${Platform.isMobile ? ' is-mobile' : ''}` });
    this.control = control;
    control.setAttribute('role', 'group');
    control.setAttribute('aria-label', 'Read and Return');
    control.style.setProperty('--nn-bottom', `${this.settings.bottom}px`);
    const returning = !!this.sessions.get(view.file.path).returnPoint;
    const button = control.createEl('button', { cls: 'read-and-return-primary' });
    const label = returning ? t("Return to saved position") : t("Jump to top and remember");
    button.type = 'button';
    button.setAttribute('aria-label', label);
    button.title = label;
    setIcon(button, returning ? 'undo-2' : 'arrow-up-to-line');
    button.addEventListener('click', () => this.run('toggle'));
    const more = control.createEl('button', { cls: 'read-and-return-more' });
    more.type = 'button';
    more.setAttribute('aria-label', t("More navigation actions"));
    more.setAttribute('aria-haspopup', 'menu');
    more.title = t("More navigation actions");
    setIcon(more, 'ellipsis');
    more.addEventListener('click', event => this.menu(event));
    // Keep toolbar use from moving the editor caret or summoning the mobile keyboard.
    control.addEventListener('pointerdown', event => { if (event.pointerType === 'mouse') event.preventDefault(); });
  }

  private removeControl() {
    this.control?.remove();
    this.host?.removeClass('read-and-return-host');
    this.control = undefined;
    this.host = undefined;
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
}

class NavigatorSettings extends PluginSettingTab {
  constructor(app: App, private plugin: NoteNavigator) { super(app, plugin); }
  display() {
    this.containerEl.empty();
    this.containerEl.createEl('h2', { text: 'Read and Return' });
    this.containerEl.createEl('p', { text: t("Navigation stays in this session; note content is never changed.") });
    new Setting(this.containerEl).setName(t("Mobile control"))
      .addToggle(toggle => toggle.setValue(this.plugin.settings.mobileControl).onChange(async value => {
        this.plugin.settings.mobileControl = value; await this.plugin.saveSettings();
      }));
    new Setting(this.containerEl).setName(t("Desktop control"))
      .addToggle(toggle => toggle.setValue(this.plugin.settings.desktopControl).onChange(async value => {
        this.plugin.settings.desktopControl = value; await this.plugin.saveSettings();
      }));
    new Setting(this.containerEl).setName(t("Side"))
      .addDropdown(dropdown => dropdown.addOption('left', t("Left")).addOption('right', t("Right"))
        .setValue(this.plugin.settings.side).onChange(async value => {
          this.plugin.settings.side = value === 'left' ? 'left' : 'right'; await this.plugin.saveSettings();
        }));
    new Setting(this.containerEl).setName(t("Bottom spacing"))
      .setDesc(t("Mobile reserves at least 96px plus the safe area; increase for taller toolbars."))
      .addSlider(slider => slider.setLimits(Platform.isMobile ? 96 : 8, 160, 8)
        .setValue(Platform.isMobile ? Math.max(96, this.plugin.settings.bottom) : this.plugin.settings.bottom).setDynamicTooltip()
        .onChange(async value => { this.plugin.settings.bottom = value; await this.plugin.saveSettings(); }));
  }
}
