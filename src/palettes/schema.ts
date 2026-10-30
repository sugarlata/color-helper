import { normalizeHex } from "../shared/color";
import type { ColorPalette, PaletteColor } from "../shared/types";

export const CURRENT_PALETTE_SCHEMA_VERSION = 2;

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  palette?: ColorPalette;
  migratedFromVersion?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function migrateVersion1To2(value: Record<string, unknown>): Record<string, unknown> {
  // Version 2 removed deprecated matching configuration and per-colour IDs.
  // Array order is the colour identity and remains unchanged.
  const { matching: _matching, ...palette } = value;
  const colors = Array.isArray(value.colors)
    ? value.colors.map((entry) => {
      if (!isRecord(entry)) return entry;
      const { id: _id, ...color } = entry;
      return color;
    })
    : value.colors;
  return { ...palette, schemaVersion: 2, colors };
}

function migratePaletteDocument(value: unknown): { value?: unknown; errors: string[]; migratedFromVersion?: number } {
  if (!isRecord(value)) return { errors: ["The JSON root must be an object."] };
  const version = value.schemaVersion;
  if (!Number.isInteger(version) || typeof version !== "number") {
    return { errors: ["schemaVersion must be an integer. This file cannot be imported safely without a format version."] };
  }
  if (version > CURRENT_PALETTE_SCHEMA_VERSION) {
    return { errors: [`This palette uses schemaVersion ${version}, but this extension supports up to version ${CURRENT_PALETTE_SCHEMA_VERSION}. Update the extension before importing it.`] };
  }
  if (version < 1) return { errors: [`schemaVersion ${version} is not supported.`] };

  const originalVersion = version;
  let currentVersion = version;
  let migrated: Record<string, unknown> = value;
  while (currentVersion < CURRENT_PALETTE_SCHEMA_VERSION) {
    if (currentVersion === 1) migrated = migrateVersion1To2(migrated);
    else return { errors: [`No migration is available from schemaVersion ${currentVersion}.`] };
    currentVersion += 1;
  }
  return {
    value: migrated,
    errors: [],
    migratedFromVersion: originalVersion < CURRENT_PALETTE_SCHEMA_VERSION ? originalVersion : undefined,
  };
}

export function validatePalette(value: unknown): ValidationResult {
  const errors: string[] = [];
  if (!isRecord(value)) return { valid: false, errors: ["The JSON root must be an object."] };
  if (value.schemaVersion !== CURRENT_PALETTE_SCHEMA_VERSION) {
    errors.push(`schemaVersion must be ${CURRENT_PALETTE_SCHEMA_VERSION}.`);
  }
  if (typeof value.id !== "string" || !value.id.trim()) errors.push("id must be a non-empty string.");
  if (typeof value.name !== "string" || !value.name.trim()) errors.push("name must be a non-empty string.");
  if (!Array.isArray(value.colors) || value.colors.length === 0) errors.push("colors must be a non-empty array.");

  const colors: PaletteColor[] = [];
  if (Array.isArray(value.colors)) value.colors.forEach((entry, index) => {
    if (!isRecord(entry)) {
      errors.push(`colors[${index}] must be an object.`);
      return;
    }
    const name = typeof entry.name === "string" ? entry.name.trim() : "";
    if (!name) errors.push(`colors[${index}].name must be a non-empty string.`);
    let hex = "";
    try { hex = normalizeHex(String(entry.hex ?? "")); }
    catch { errors.push(`colors[${index}].hex must be a six-digit HEX colour such as #63734A.`); }
    if (entry.highlighted !== undefined && typeof entry.highlighted !== "boolean") {
      errors.push(`colors[${index}].highlighted must be true or false when provided.`);
    }
    if (name && hex) {
      const color: PaletteColor = { name, hex };
      if (entry.highlighted === true) color.highlighted = true;
      colors.push(color);
    }
  });

  let source: ColorPalette["source"];
  if (value.source !== undefined) {
    if (!isRecord(value.source)) errors.push("source must be an object.");
    else if (typeof value.source.type !== "string" || !value.source.type.trim()) errors.push("source.type must be a non-empty string.");
    else source = { ...value.source, type: value.source.type.trim() };
  }

  if (errors.length) return { valid: false, errors };
  const palette: ColorPalette = {
    schemaVersion: CURRENT_PALETTE_SCHEMA_VERSION,
    id: String(value.id).trim(),
    name: String(value.name).trim(),
    colors,
  };
  if (typeof value.description === "string") palette.description = value.description;
  if (typeof value.system === "string") palette.system = value.system;
  if (source) palette.source = source;
  return { valid: true, errors: [], palette };
}

export function normalizePalette(value: unknown): ValidationResult {
  const migration = migratePaletteDocument(value);
  if (migration.errors.length) return { valid: false, errors: migration.errors };
  const result = validatePalette(migration.value);
  if (result.valid && migration.migratedFromVersion !== undefined) {
    result.migratedFromVersion = migration.migratedFromVersion;
  }
  return result;
}

export function parsePaletteJson(json: string): ValidationResult {
  try { return normalizePalette(JSON.parse(json)); }
  catch (error) { return { valid: false, errors: [`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`] }; }
}

export function serializePaletteJson(value: unknown): string {
  const result = normalizePalette(value);
  if (!result.valid || !result.palette) throw new Error(result.errors.join(" "));
  return `${JSON.stringify(result.palette, null, 2)}\n`;
}
