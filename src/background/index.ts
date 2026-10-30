import type { RuntimeMessage } from "../shared/messages";
import { ext, injectContent, sendTabMessage } from "../shared/webext";
import { loadData, saveData } from "../palettes/storage";

const PALETTE_MENU_ID = "activate-palette";
const PALETTE_ITEM_PREFIX = "activate-palette:";
let menuBuild = Promise.resolve();

function removeAllMenus(): Promise<void> {
  return new Promise((resolve, reject) => {
    ext.contextMenus.removeAll(() => {
      const error = ext.runtime.lastError?.message;
      if (error) reject(new Error(error));
      else resolve();
    });
  });
}

function createMenuItem(properties: chrome.contextMenus.CreateProperties): Promise<void> {
  return new Promise((resolve, reject) => {
    ext.contextMenus.create(properties, () => {
      const error = ext.runtime.lastError?.message;
      if (error) reject(new Error(error));
      else resolve();
    });
  });
}

async function rebuildPaletteMenu(): Promise<void> {
  const data = await loadData();
  await removeAllMenus();
  await createMenuItem({
    id: PALETTE_MENU_ID,
    title: "Activate palette",
    contexts: ["action"],
  });
  for (const palette of data.palettes) {
    await createMenuItem({
      id: `${PALETTE_ITEM_PREFIX}${palette.id}`,
      parentId: PALETTE_MENU_ID,
      title: palette.name,
      type: "radio",
      checked: palette.id === data.activePaletteId,
      contexts: ["action"],
    });
  }
}

function queuePaletteMenuRebuild(): void {
  menuBuild = menuBuild
    .then(rebuildPaletteMenu)
    .catch((error) => { console.warn("Could not update the palette menu.", error); });
}

async function toggleDial(tab: chrome.tabs.Tab): Promise<void> {
  if (tab.id === undefined) return;
  try {
    await sendTabMessage(tab.id, { type: "toggle-dial" } satisfies RuntimeMessage);
    return;
  } catch {
    // Install the page component only after an explicit toolbar click.
  }

  try {
    await injectContent(tab.id);
    for (let attempt = 0; attempt < 12; attempt += 1) {
      try {
        await sendTabMessage(tab.id, { type: "toggle-dial" } satisfies RuntimeMessage);
        return;
      } catch {
        await new Promise((resolve) => setTimeout(resolve, 40));
      }
    }
  } catch (error) {
    console.warn("Color Palette Helper cannot run on this page.", error);
  }
}

ext.action.onClicked.addListener((tab) => { void toggleDial(tab); });

ext.runtime.onInstalled.addListener(() => { queuePaletteMenuRebuild(); });

ext.storage.onChanged.addListener((_changes, areaName) => {
  if (areaName === "local") queuePaletteMenuRebuild();
});

ext.contextMenus.onClicked.addListener((info) => {
  const menuItemId = String(info.menuItemId);
  if (!menuItemId.startsWith(PALETTE_ITEM_PREFIX)) return;
  const paletteId = menuItemId.slice(PALETTE_ITEM_PREFIX.length);
  void (async () => {
    const data = await loadData();
    if (!data.palettes.some((palette) => palette.id === paletteId)) return;
    data.activePaletteId = paletteId;
    await saveData(data);
  })().catch((error) => { console.warn("Could not activate the selected palette.", error); });
});
