# Link Title on Paste

Paste a web address and get a Markdown link with the page's title, `[Page title](https://…)`, without leaving the keyboard.

![A list item holding a bare Wikipedia address that, a moment after pasting, becomes the link [Markdown - Wikipedia](https://en.wikipedia.org/wiki/Markdown)](https://raw.githubusercontent.com/perezamadorluisenrique-gif/link-title-on-paste/main/docs/paste-title.gif)

The address goes in at once, exactly as Obsidian would paste it. A moment later the plugin reads the page's title and turns the address into a link. If the page has no usable title, or cannot be reached, the address stays as it was. One **Undo** after the link appears gives you the bare address back.

## Network use

**This plugin sends web requests.** To read a title it requests the page you pasted, from your device, with Obsidian's `requestUrl`. The site you paste sees that request, and nothing is sent anywhere else: no analytics, no third-party service. Only the first 300 KB of the page is read, and only `http` and `https` addresses are requested.

- Local and private addresses (`localhost`, `192.168.x.x`, `10.x.x.x`, `.local`…) are **never** requested.
- Add sites to **Skipped domains** and they, and their subdomains, are never requested either.
- Turn off **Fetch the title when pasting a web address** to use only the commands below.

## What it does and does not touch

It acts only when the whole clipboard is one web address and nothing is selected. It leaves things alone when:

- you have text selected (Obsidian turns your text into a link by itself);
- you paste inside a code block, inline code, a link, a `[[wikilink]]` or the properties block;
- the clipboard holds anything more than one address;
- you have several cursors.

If you keep typing while the title loads, the link still lands in the right place; if you deleted or edited the address, it is left alone.

## Commands

| Command | What it does |
|---|---|
| Paste URL with title | Pastes the address on the clipboard and adds its title. Handy on mobile, or when the automatic paste is off. |
| Fetch title for the current link | Turns the bare address under the cursor, or an empty link `[](https://…)`, into a titled link. A link that already has text is never changed. |
| Add titles to the links in this note or selection | Finds every bare web address in the selection, or in the whole note when nothing is selected, and turns each into a titled link. |

### Adding titles to a whole note

The pages are requested three at a time, with a notice showing progress ("Fetching titles: 4 of 12"). Nothing changes in the note until they are all done, and then every link is written at once, so one **Undo** puts all the bare addresses back. A final notice says how many titles were added and how many addresses were left as they were.

- Addresses that are already links, inside `[[wikilinks]]`, code (inline or fenced), the properties block, HTML tags or comments are left alone, and so are your **Skipped domains** and private addresses. An address in `<angle brackets>` is treated as a bare one.
- An address that has no usable title, or cannot be reached, stays as it was.
- If you edit an address while the titles load, that one is skipped. Text you type elsewhere does not matter.
- Run the command again while it is working to cancel it. Nothing is written.

No default hotkeys; assign your own in **Settings → Hotkeys**.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Fetch the title when pasting a web address | on | Read the page when you paste a lone address. |
| Skipped domains | none | One per line. These sites and their subdomains are never requested. |

## Notes

- The title is the page's `<title>`, falling back to its `og:title` and `twitter:title`. HTML entities are decoded, whitespace is collapsed and brackets are escaped.
- Pages that are not HTML (images, PDFs) and titles that only repeat the address are skipped.
- Redirects are followed by Obsidian's request layer, so a public address that redirects to a private one is not stopped, and pages are read as UTF-8 whatever their declared charset.
- If the title arrives within about half a second, Obsidian groups it with the paste into one undo step.

## Installation

In Obsidian, open **Settings → Community plugins → Browse** and search for "Link Title on Paste".

## More plugins by Siulved54

| Plugin | What it does | Source |
| --- | --- | --- |
| [Shared Blocks](https://obsidian.md/plugins?id=shared-blocks) | Write a block of text once and reuse it in any note. Edit the source and every reference re-renders live. | [shared-blocks](https://github.com/perezamadorluisenrique-gif/shared-blocks) |
| [Text Case and Cleanup](https://obsidian.md/plugins?id=text-format) | Change case, make camelCase or slugs, sort lines and remove duplicates, and repair text pasted out of a PDF, without touching code or URLs. | [text-format](https://github.com/perezamadorluisenrique-gif/text-format) |
| [Typography as You Type](https://obsidian.md/plugins?id=typography-as-you-type) | Curly quotes, dashes and ellipses as you type, kept out of code and maths, with Backspace to take one back. | [smart-typography-plugin](https://github.com/perezamadorluisenrique-gif/smart-typography-plugin) |
| [Section Numbering](https://obsidian.md/plugins?id=section-numbering) | Number headings as an outline (1, 1.1, 1.2) and keep every link to them working when they renumber. | [section-numbering](https://github.com/perezamadorluisenrique-gif/section-numbering) |
| [Spreadsheet to Table](https://obsidian.md/plugins?id=spreadsheet-to-table) | Paste cells from Excel or Google Sheets as a Markdown table with a real header, insert CSV files, and copy tables back out. | [spreadsheet-to-table](https://github.com/perezamadorluisenrique-gif/spreadsheet-to-table) |
| [Hybrid Line Numbers](https://obsidian.md/plugins?id=hybrid-line-numbers) | Relative and hybrid line numbers for Vim-style jumps, where a folded section counts as one line. | [hybrid-line-numbers](https://github.com/perezamadorluisenrique-gif/hybrid-line-numbers) |
| [List Item Callouts](https://obsidian.md/plugins?id=list-item-callouts) | Colour a single list item as a callout by starting it with a character such as `&`, `!` or `?`. | [list-item-callouts](https://github.com/perezamadorluisenrique-gif/list-item-callouts) |
| [Folder Counts](https://obsidian.md/plugins?id=folder-counts) | See how many notes or files each folder holds, right in the file explorer, with a vault total and folder exclusions. | [folder-counts](https://github.com/perezamadorluisenrique-gif/folder-counts) |
| [Note Reading Time](https://obsidian.md/plugins?id=note-reading-time) | Reading time of the current note or your selection in the status bar, optionally saved to a property. | [note-reading-time](https://github.com/perezamadorluisenrique-gif/note-reading-time) |
| [Task Rollover](https://obsidian.md/plugins?id=task-rollover) | Roll unfinished tasks from your last daily note into today's when it is created, with a real undo. | [task-rollover](https://github.com/perezamadorluisenrique-gif/task-rollover) |
| [Zoom Into Section](https://obsidian.md/plugins?id=zoom-into-section) | Zoom into a heading or list item to see only it and its contents, with a breadcrumb bar to climb back out. | [zoom-into-section](https://github.com/perezamadorluisenrique-gif/zoom-into-section) |
| [Update Radar](https://obsidian.md/plugins?id=update-radar) | Checks your installed community plugins for updates in the background, shows what changed, and flags the ones that look abandoned. | [community-update-checker](https://github.com/perezamadorluisenrique-gif/community-update-checker) |
| [Dataview to Bases](https://obsidian.md/plugins?id=dataview-to-bases) | Convert Dataview queries into Bases blocks, and see which queries in your vault can be converted. | [dataview-to-bases](https://github.com/perezamadorluisenrique-gif/dataview-to-bases) |
| [Line Editing Commands](https://obsidian.md/plugins?id=line-editing-commands) | Duplicate, join, sort and reverse lines, insert blank lines and jump to a line number, with multi-cursor support. | [line-editing-commands](https://github.com/perezamadorluisenrique-gif/line-editing-commands) |
| [Note Mover Rules](https://obsidian.md/plugins?id=note-mover-rules) | Move notes into folders by ordered rules on tags, properties, titles and paths, with a preview before any bulk move. | [note-mover-rules](https://github.com/perezamadorluisenrique-gif/note-mover-rules) |
| [Tab History](https://obsidian.md/plugins?id=tab-history) | Keeps each tab's back and forward history across restarts, and adds commands to move, maximize and close tabs. | [tab-history](https://github.com/perezamadorluisenrique-gif/tab-history) |
| [URL Cards](https://obsidian.md/plugins?id=url-cards) | Shows web addresses as cards with title, description and image, and reads existing cardlink blocks. | [url-cards](https://github.com/perezamadorluisenrique-gif/url-cards) |
| [Vim Config](https://obsidian.md/plugins?id=vim-config) | Loads a vimrc-style file from your vault so your key mappings and editor commands are ready when vim mode starts. | [vim-config](https://github.com/perezamadorluisenrique-gif/vim-config) |
| [Task Archive](https://obsidian.md/plugins?id=task-archive) | Moves completed tasks, with their sub-items, into an archive section or note. | [task-archive](https://github.com/perezamadorluisenrique-gif/task-archive) |
| [Revisit Later](https://obsidian.md/plugins?id=revisit-later) | Link the current note into a future daily note, with a date typed in plain English, so it comes back when you want to review it. | [revisit-later](https://github.com/perezamadorluisenrique-gif/revisit-later) |
| [Explorer Colors Plus](https://obsidian.md/plugins?id=explorer-colors-plus) | Color files and folders in the file explorer, with a palette, cascading to children, and import from File Color. | [explorer-colors-plus](https://github.com/perezamadorluisenrique-gif/explorer-colors-plus) |
| [Book Lookup](https://obsidian.md/plugins?id=book-lookup) | Create book notes from Open Library or Google Books, with cover images, ISBN search and Book Search compatible templates. | [book-lookup](https://github.com/perezamadorluisenrique-gif/book-lookup) |
| [Web Search Menu](https://obsidian.md/plugins?id=web-search-menu) | Search the web for selected text or the note title from the right-click menu, with engines you define. | [web-search-menu](https://github.com/perezamadorluisenrique-gif/web-search-menu) |

All of them are in the community directory: Settings -> Community plugins ->
Browse, then search for the name.
