import rainbowJson from "./rainbow.json";
import type { ColorPalette, StoredData } from "../shared/types";
import { DEFAULT_MATCHER_SETTINGS } from "../shared/types";
import { storageGet, storageSet } from "../shared/webext";
import { normalizePalette, validatePalette } from "./schema";

const STORAGE_KEY = "colorPaletteHelperData";
const DEFAULT_PALETTE_ID = "rainbow-example";

function bundledPalette(): ColorPalette {
  const result = validatePalette(rainbowJson);
  if (!result.valid || !result.palette) throw new Error(`Bundled palette is invalid: ${result.errors.join(" ")}`);
  return result.palette;
}

export async function loadData(): Promise<StoredData> {
  const result = await storageGet<Record<string, unknown>>(STORAGE_KEY);
  const stored = result[STORAGE_KEY];
  if (stored && typeof stored === "object") {
    const candidate = stored as Partial<StoredData>;
    const normalized = Array.isArray(candidate.palettes) ? candidate.palettes.map(normalizePalette) : [];
    const palettes = normalized.filter((item) => item.valid && item.palette).map((item) => item.palette!);
    if (palettes.length) {
      const activePaletteId = palettes.some((palette) => palette.id === candidate.activePaletteId)
        ? candidate.activePaletteId!
        : palettes[0]!.id;
      const loaded = {
        palettes,
        activePaletteId,
        matcherSettings: { ...DEFAULT_MATCHER_SETTINGS, ...candidate.matcherSettings },
      };
      if (normalized.some((item) => item.migratedFromVersion !== undefined)) await saveData(loaded);
      return loaded;
    }
  }
  const initial: StoredData = {
    palettes: [bundledPalette()],
    activePaletteId: DEFAULT_PALETTE_ID,
    matcherSettings: { ...DEFAULT_MATCHER_SETTINGS },
  };
  await saveData(initial);
  return initial;
}

export async function saveData(data: StoredData): Promise<void> {
  await storageSet({ [STORAGE_KEY]: data });
}

export async function activePalette(): Promise<ColorPalette> {
  const data = await loadData();
  return data.palettes.find((palette) => palette.id === data.activePaletteId) ?? data.palettes[0]!;
}
