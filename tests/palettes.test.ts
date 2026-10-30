import { describe, expect, it } from "vitest";
import { CURRENT_PALETTE_SCHEMA_VERSION, parsePaletteJson, serializePaletteJson, validatePalette } from "../src/palettes/schema";
import rainbowPalette from "../src/palettes/rainbow.json";
import { dialRotationRadians, segmentOuterRadius, segmentSeamOverlap } from "../src/content/overlay";

const valid = {
  schemaVersion: 2, id: "test", name: "Test", description: "Description",
  source: { type: "calibrated", device: "example-meter" },
  colors: [{ name: "One", hex: "#abcdef" }],
};

describe("palette schema", () => {
  it("accepts the bundled seven-colour Rainbow example", () => {
    const result = validatePalette(rainbowPalette);
    expect(result.errors).toEqual([]);
    expect(result.palette?.id).toBe("rainbow-example");
    expect(result.palette?.colors).toHaveLength(7);
    expect(result.palette?.colors[0]).toEqual({ name: "Red", hex: "#E53935" });
    expect(result.palette?.colors[6]).toEqual({ name: "Violet", hex: "#8E24AA" });
  });

  it("preserves stronger-colour highlights", () => {
    const result = validatePalette({ ...valid, colors: [{ name: "One", hex: "#ABCDEF", highlighted: true }] });
    expect(result.palette?.colors[0]?.highlighted).toBe(true);
    expect(segmentOuterRadius(300, false)).toBe(150);
    expect(segmentOuterRadius(300, true)).toBe(162);
    expect(segmentSeamOverlap(Math.PI * 2 / 50, 98)).toBeGreaterThan(0);
    expect(segmentSeamOverlap(Math.PI * 2 / 50, 98)).toBeLessThan(Math.PI / 50);
    expect(dialRotationRadians(90)).toBeCloseTo(Math.PI / 2);
    expect(dialRotationRadians(360)).toBeCloseTo(Math.PI * 2);
  });

  it("normalises and serialises the current schema without losing order", () => {
    const result = validatePalette(valid);
    expect(result.valid).toBe(true);
    expect(result.palette?.colors).toEqual([{ name: "One", hex: "#ABCDEF" }]);
    expect(result.palette?.source?.device).toBe("example-meter");
    expect(JSON.parse(JSON.stringify(result.palette))).toEqual(result.palette);
    expect(JSON.parse(serializePaletteJson(result.palette!)).schemaVersion).toBe(CURRENT_PALETTE_SCHEMA_VERSION);
  });

  it("migrates version 1 files to version 2", () => {
    const legacy = {
      ...valid,
      schemaVersion: 1,
      matching: { engine: "perceptual-v1", threshold: 15 },
      colors: [{ id: "one", name: "One", hex: "#ABCDEF", highlighted: true }],
    };
    const result = parsePaletteJson(JSON.stringify(legacy));
    expect(result.valid).toBe(true);
    expect(result.migratedFromVersion).toBe(1);
    expect(result.palette?.schemaVersion).toBe(2);
    expect(result.palette?.colors).toEqual([{ name: "One", hex: "#ABCDEF", highlighted: true }]);
    expect(result.palette).not.toHaveProperty("matching");
  });

  it("rejects unsupported future versions with an upgrade message", () => {
    const result = parsePaletteJson(JSON.stringify({ ...valid, schemaVersion: 99 }));
    expect(result.valid).toBe(false);
    expect(result.errors.join(" ")).toMatch(/Update the extension before importing/);
  });

  it("returns actionable structural errors", () => {
    const result = validatePalette({ schemaVersion: 1, id: "", name: "", colors: [{ name: "", hex: "red" }] });
    expect(result.errors.join(" ")).toMatch(/schemaVersion must be 2/);
    expect(result.errors.join(" ")).toMatch(/six-digit HEX/);
  });

  it("rejects malformed JSON before validation", () => {
    expect(parsePaletteJson("{").errors[0]).toMatch(/^Invalid JSON:/);
  });
});
