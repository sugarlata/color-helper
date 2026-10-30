export type ExtensionMode = "idle" | "visual";

export type ActivityState =
  | "idle"
  | "visual"
  | "unsupported"
  | "error";

export interface PaletteColor {
  name: string;
  hex: string;
  highlighted?: boolean;
}

export interface PaletteSource {
  type: string;
  description?: string;
  [key: string]: unknown;
}

export interface ColorPalette {
  schemaVersion: 2;
  id: string;
  name: string;
  description?: string;
  system?: string;
  source?: PaletteSource;
  colors: PaletteColor[];
}

export interface MatcherSettings {
  diameter: number;
  thickness: number;
  opacity: number;
  rotation: number;
}

export interface TabState {
  mode: ExtensionMode;
  activity: ActivityState;
  error?: string;
}

export interface ColorMatchResult {
  matched: boolean;
  score: number;
  nearestColorId?: string;
  distance?: number;
  reason?: string;
}

export interface SampleRecord {
  x: number;
  y: number;
  hex: string;
  matched: boolean;
  distance: number;
  nearestPaletteColorId?: string;
}

export interface StoredData {
  palettes: ColorPalette[];
  activePaletteId: string;
  matcherSettings: MatcherSettings;
}

export const DEFAULT_MATCHER_SETTINGS: MatcherSettings = {
  diameter: 300,
  thickness: 80,
  opacity: 1,
  rotation: 0,
};

