# SimpleCMS

**Simply simple.** Build a one-page website right in your browser, then export it as a zip that's ready to put online. No account, no server, nothing uploaded.

<img width="1920" height="985" alt="simplycms_preview1" src="https://github.com/user-attachments/assets/62479727-507d-41f7-accb-db42ef63501e" />

 [Privacy policy](PRIVACY.md)

---

## Why SimpleCMS?

Most site builders want an account, a subscription, and your content on their servers. SimpleCMS is the opposite: a small editor that lives in a browser tab. You type straight onto the page, arrange it with a simple menu, and export plain files you can host anywhere. It's for the small business page, the portfolio, the club or event site. It's not trying to be WordPress.

## Features

- **Edit right on the page.** Click any text and start typing.
- **Widgets:** text, image galleries, tables, contact forms, code blocks, and custom HTML.
- **Builder menu** on a slim side tab. Add, reorder, hide, rename, or delete sections and widgets. Dock it beside the page so it never covers your work, and adjust its opacity.
- **Theme:** pick a color, choose from three font styles, and use a text or image logo.
- **SEO basics:** set the browser title and search description.
- **Automatic navigation** built from your sections.
- **Preview mode** shows the page exactly as visitors will see it.
- **Autosave**, plus project files you can back up and reopen.
- **One-click export** to a zip containing `index.html`, `images/`, and `fonts/`.
- **Round trip:** open an exported zip later to keep editing, images included.
- **Private by design:** no permissions, no data collection, works offline.

## Getting started

1. Install SimpleCMS from the Chrome Web Store and pin it to your toolbar.
2. Click the icon. The editor opens in its own tab (clicking again brings you back to it).
3. Click any text on the page to edit it.
4. Open the **⚙ Builder** tab on the left edge to add sections and widgets.
5. When you're happy, click **💾 Export Site (.zip)**.

## Building your page

| Widget | What it's for |
|---|---|
| **Text** | Headings and paragraphs. Every new section starts with one. |
| **Gallery** | Image cards with captions. Click an image to replace it, **+Img** to add a card, **×** to remove one. |
| **Table** | Services, prices, schedules. Edit cells directly. |
| **Contact** | A form that sends to your email or a form service (see below). |
| **Code** | A monospace block for snippets or commands. |
| **HTML** | Paste your own HTML, like a map or video embed, using the **</>** button. |

Each section appears in the navigation automatically, using the section's name. Hidden sections and widgets stay in your project but are left out of the export.

## Your work is saved automatically

- **Autosave:** every change is saved on your computer as you work, so closing the tab or restarting Chrome is fine. Autosave belongs to your Chrome profile and is removed if you uninstall the extension.
- **📝 Save Project** downloads a `*_project.html` file. Use it as a backup, or to move your work to another computer.
- **📂 Open** reopens a project file or an exported site zip. It can also open a bare `index.html`, but images only come back from a zip.
- **↺ Reset** starts over from the starter page (it asks first).

## Putting your site online

An export looks like this:

```
simplecms_site.zip
├── index.html
├── images/      your photos, with their original filenames
└── fonts/       the site's fonts and their licenses
```

Unzip it and upload the contents to any static host, such as GitHub Pages, Netlify, Cloudflare Pages, or a regular web hosting account. You can also double-click `index.html` to preview it locally. All paths are relative, so it works from a subfolder too.

The exported page is lightweight HTML and CSS. It contains none of the editor's code, no tracking, and no calls to outside font services.

## Contact forms

Click **✉** next to a contact widget to choose where messages go:

- **An email address** makes the form open the visitor's email app with the message filled in. It's simple, but how well it works depends on the visitor's device.
- **A form service URL** (`https://…`) sends submissions to a service that forwards them to you. This is the more reliable option for a business site.

If you leave it blank, the form is shown but doesn't send.

## Privacy

SimpleCMS requests **no browser permissions** and **collects no data**. Everything you create stays on your computer until you choose to publish it. The editor makes no network requests of its own, and its fonts and zip library are bundled inside the extension. Full details are in the [privacy policy](PRIVACY.md).

## Good to know

- SimpleCMS builds **one-page sites** with a section-based layout.
- Code in an **HTML widget** doesn't run inside the editor, a browser security rule for extensions. It does run on your exported site, so only paste code you trust.
- Anything you embed (a map, a video) loads from its own provider when your site is viewed.
- Autosave keeps **one** working project. Use **Save Project** to keep several.

## Installing from source

1. Download or clone this repository.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Click **Load unpacked** and select the folder containing `manifest.json`.

## Credits

- [JSZip](https://stuk.github.io/jszip/), dual licensed MIT / GPLv3
- [Inter](https://github.com/rsms/inter) and [Playfair Display](https://github.com/clauseggers/Playfair-Display), SIL Open Font License 1.1

## License

MIT © 2026 DUCTOPS
