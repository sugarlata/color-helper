import { activePalette, loadData } from "../palettes/storage";
import type { RuntimeMessage } from "../shared/messages";
import type { ColorPalette, MatcherSettings, TabState } from "../shared/types";
import { DEFAULT_MATCHER_SETTINGS } from "../shared/types";
import { ext } from "../shared/webext";
import { PageOverlay } from "./overlay";

declare global { interface Window { __colourPaletteMatcherLoaded?: boolean } }

if (!window.__colourPaletteMatcherLoaded) {
  window.__colourPaletteMatcherLoaded = true;
  void start();
}

async function start(): Promise<void> {
  const overlay = new PageOverlay();
  let palette: ColorPalette = await activePalette();
  let settings: MatcherSettings = { ...DEFAULT_MATCHER_SETTINGS, ...(await loadData()).matcherSettings };
  let state: TabState = { mode: "idle", activity: "idle" };

  function setMode(mode: "idle" | "visual"): TabState {
    state = { mode, activity: mode === "visual" ? "visual" : "idle" };
    if (mode === "visual") overlay.renderRing(palette, settings);
    else overlay.hideRing();
    return state;
  }

  async function refreshData(): Promise<void> {
    const data = await loadData();
    palette = await activePalette();
    settings = data.matcherSettings;
    if (state.mode === "visual") overlay.renderRing(palette, settings);
  }

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.mode === "visual") setMode("idle");
  }, true);
  window.addEventListener("pointermove", (event) => {
    if (state.mode === "visual") overlay.positionRing(event.clientX, event.clientY);
  }, { capture: true, passive: true });

  ext.runtime.onMessage.addListener((message: RuntimeMessage, _sender, sendResponse) => {
    if (message.type === "content-ready") { sendResponse({ ok: true }); return; }
    if (message.type === "get-state") { sendResponse(state); return; }
    if (message.type === "set-mode") { sendResponse(setMode(message.mode)); return; }
    if (message.type === "toggle-dial") {
      sendResponse(setMode(state.mode === "visual" ? "idle" : "visual"));
      return;
    }
    if (message.type === "palette-updated") {
      void (async () => {
        await refreshData();
        sendResponse(state);
      })();
      return true;
    }
    if (message.type === "settings-updated") {
      settings = message.settings;
      if (state.mode === "visual") overlay.renderRing(palette, settings);
      sendResponse(state);
    }
  });
  ext.storage.onChanged.addListener((_changes, areaName) => {
    if (areaName === "local") void refreshData();
  });
}
