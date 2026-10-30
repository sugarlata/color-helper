# Color Palette Helper

A local-only Chrome and Firefox extension that places a cursor-following personal colour-palette dial over any normal webpage.

The extension uses a high-resolution, transparent rainbow colour-wheel icon with browser-optimised 16, 32, 48 and 128 pixel variants.

## Build and test

Requires Node.js 20 or newer.

```sh
npm install
npm run check
npm run package
```

Unpacked builds are written to `dist/chrome` and `dist/firefox`. Packaging creates the ZIP/XPI archives in `packages/` and refreshes matching extracted folders at `packages/color-palette-helper-chrome` and `packages/color-palette-helper-firefox`. Use the Chrome folder with **Load unpacked**, or load the Firefox folder's `manifest.json` from `about:debugging`.

## Usage

Click the extension toolbar button on a normal webpage to show the dial. Move the pointer to position it over a garment or other item. Click the extension button again, or press Escape, to close it. The dial never intercepts clicks or scrolling.

Right-click the toolbar button and open **Activate palette** to switch palettes directly. The selected palette is marked in the submenu and any open dial updates immediately.

Open the extension's settings from its browser extension menu (right-click the toolbar icon and choose **Options**, or open its details/preferences page). Settings have two sections:

- **General** controls dial diameter, ring width, opacity and rotation.
- **Palettes** first selects the palette used by the dial, then provides a separate area for creating, importing, editing, exporting and deleting palettes. Colours are ordered objects containing a name, HEX value and optional stronger-colour highlight; drag their handles to reorder them.

The extension includes a generic seven-colour Rainbow example palette. Imported palette JSON is validated before local storage.

Palette JSON uses an explicit schema version. The current export format is version 2; version 1 imports are migrated automatically, while files from newer unsupported versions are rejected with an upgrade message.

## Privacy and permissions

The extension has no network code, telemetry, backend, screenshots, or external runtime dependencies. Palette and dial settings use local extension storage, never synchronised storage.

`activeTab` and `scripting` install the dial only after an explicit toolbar click, avoiding blanket access to every website. `storage` stores palettes and settings locally. Browser-internal and other protected pages may reject content-script injection.
