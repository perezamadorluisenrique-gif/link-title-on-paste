# Link Title on Paste

Paste a web address and get a Markdown link with the page's title, `[Page title](https://…)`, without leaving the keyboard.

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

No default hotkeys; assign your own in **Settings → Hotkeys**.

## Settings

| Setting | Default | What it does |
|---|---|---|
| Fetch the title when pasting a web address | on | Read the page when you paste a lone address. |
| Skipped domains | none | One per line. These sites and their subdomains are never requested. |

## Notes

- The title is the page's `<title>`, falling back to its `og:title` and `twitter:title`. HTML entities are decoded, whitespace is collapsed and brackets are escaped.
- Pages that are not HTML (images, PDFs) and titles that only repeat the address are skipped.
- If the title arrives within about half a second, Obsidian groups it with the paste into one undo step.

## Installation

In Obsidian, open **Settings → Community plugins → Browse** and search for "Link Title on Paste".
