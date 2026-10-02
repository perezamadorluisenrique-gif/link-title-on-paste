import { Notice, Plugin, PluginSettingTab, Setting, requestUrl } from 'obsidian';
import type { App, Editor, MarkdownFileInfo } from 'obsidian';

import {
  asBareUrl,
  canLinkAt,
  extractTitle,
  findTargetInLine,
  isSkipped,
  isUselessTitle,
  linkableCopies,
  locateUrl,
  markdownLink,
  parseSkipList,
} from './src/logic.ts';

interface LinkTitleSettings {
  /** Fetch the title when a bare URL is pasted. The commands work either way. */
  titleOnPaste: boolean;
  /** One domain per line; subdomains count. Pages on these are never requested. */
  skipDomains: string;
}

const DEFAULT_SETTINGS: LinkTitleSettings = {
  titleOnPaste: true,
  skipDomains: '',
};

const TIMEOUT_MS = 10_000;

export default class LinkTitleOnPastePlugin extends Plugin {
  settings: LinkTitleSettings = { ...DEFAULT_SETTINGS };

  async onload() {
    const data = (await this.loadData()) as Partial<LinkTitleSettings> | null;
    this.settings = { ...DEFAULT_SETTINGS, ...data };

    this.registerEvent(
      this.app.workspace.on('editor-paste', (evt, editor, info) => {
        if (evt.defaultPrevented || !this.settings.titleOnPaste) return;
        const url = asBareUrl(evt.clipboardData?.getData('text/plain') ?? '');
        if (!url || this.skipped(url)) return;
        // A selection means "link this text": Obsidian does that itself.
        if (editor.somethingSelected() || editor.listSelections().length > 1) return;
        const offset = editor.posToOffset(editor.getCursor());
        if (!canLinkAt(editor.getValue(), offset)) return;
        evt.preventDefault();
        const before = linkableCopies(editor.getValue(), url).length;
        // The bare URL goes in first, as Obsidian would paste it, so one undo
        // after the title arrives gives it back.
        editor.replaceSelection(url);
        void this.titleUrlAt(editor, info, url, offset, before);
      }),
    );

    this.addCommand({
      id: 'paste-url-with-title',
      name: 'Paste URL with title',
      icon: 'clipboard-paste',
      editorCallback: (editor, ctx) => void this.pasteFromClipboard(editor, ctx),
    });

    this.addCommand({
      id: 'fetch-title-for-link',
      name: 'Fetch title for the current link',
      icon: 'link',
      editorCallback: (editor, ctx) => void this.titleUnderCursor(editor, ctx),
    });

    this.addSettingTab(new LinkTitleSettingTab(this.app, this));
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private skipped(url: string): boolean {
    return isSkipped(url, parseSkipList(this.settings.skipDomains));
  }

  /** The page title for `url`, or null when it has none, is not a web page or cannot be reached. */
  private async fetchTitle(url: string): Promise<string | null> {
    try {
      const request = requestUrl({ url, throw: false, headers: { Accept: 'text/html,application/xhtml+xml' } });
      let timer = 0;
      const timeout = new Promise<null>((resolve) => {
        timer = window.setTimeout(() => resolve(null), TIMEOUT_MS);
      });
      const res = await Promise.race([request, timeout]).finally(() => window.clearTimeout(timer));
      if (!res || res.status >= 400) return null;
      const type = Object.entries(res.headers).find(([k]) => k.toLowerCase() === 'content-type')?.[1] ?? '';
      if (type && !/html|xml/i.test(type)) return null;
      const title = extractTitle(res.text);
      return title && !isUselessTitle(title, url) ? title : null;
    } catch {
      return null;
    }
  }

  /** Turns the bare URL that was just pasted at `offset` into a titled link, wherever it has moved to. */
  private async titleUrlAt(editor: Editor, info: MarkdownFileInfo, url: string, offset: number, before: number) {
    // The editor is reused when the tab opens another note, so remember which one this was.
    const path = info.file?.path;
    const title = await this.fetchTitle(url);
    if (!title || info.file?.path !== path) return;
    const where = locateUrl(editor.getValue(), url, offset, before);
    if (!where) return;
    editor.transaction({
      changes: [{ from: editor.offsetToPos(where.from), to: editor.offsetToPos(where.to), text: markdownLink(title, url) }],
    });
  }

  private async pasteFromClipboard(editor: Editor, info: MarkdownFileInfo) {
    let text = '';
    try {
      text = await navigator.clipboard.readText();
    } catch {
      new Notice('Could not read the clipboard.');
      return;
    }
    const url = asBareUrl(text);
    if (!url) {
      new Notice('The clipboard does not hold a single web address.');
      return;
    }
    const offset = editor.posToOffset(editor.getCursor('from'));
    const before = linkableCopies(editor.getValue(), url).length;
    editor.replaceSelection(url);
    if (this.skipped(url)) return;
    await this.titleUrlAt(editor, info, url, offset, before);
  }

  private async titleUnderCursor(editor: Editor, info: MarkdownFileInfo) {
    const cursor = editor.getCursor();
    const path = info.file?.path;
    const target = findTargetInLine(editor.getLine(cursor.line), cursor.ch);
    if (!target) {
      new Notice('No web address here.');
      return;
    }
    if (this.skipped(target.url)) {
      new Notice('This address is on the skip list or is not a public web page.');
      return;
    }
    const title = await this.fetchTitle(target.url);
    if (!title) {
      new Notice('Could not find a title for this page.');
      return;
    }
    // The note or the line may have changed while the page loaded; only edit if the same link is still there.
    if (info.file?.path !== path) return;
    const now = findTargetInLine(editor.getLine(cursor.line), target.from);
    if (!now || now.url !== target.url) return;
    editor.transaction({
      changes: [
        {
          from: { line: cursor.line, ch: now.from },
          to: { line: cursor.line, ch: now.to },
          text: markdownLink(title, target.url),
        },
      ],
    });
  }
}

class LinkTitleSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: LinkTitleOnPastePlugin,
  ) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName('Fetch the title when pasting a web address')
      .setDesc(
        'When you paste a lone address, the plugin requests that page to read its title. The address is sent to the site. Turn this off to use only the commands.',
      )
      .addToggle((t) =>
        t.setValue(this.plugin.settings.titleOnPaste).onChange(async (v) => {
          this.plugin.settings.titleOnPaste = v;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName('Skipped domains')
      .setDesc('One domain per line. These sites and their subdomains are never requested. Local and private addresses are always skipped.')
      .addTextArea((t) =>
        t
          .setPlaceholder('example.com')
          .setValue(this.plugin.settings.skipDomains)
          .onChange(async (v) => {
            this.plugin.settings.skipDomains = v;
            await this.plugin.saveSettings();
          }),
      );
  }
}
