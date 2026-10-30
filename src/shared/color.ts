const HEX_PATTERN = /^#?([\da-f]{6})$/i;

export function normalizeHex(value: string): string {
  const match = HEX_PATTERN.exec(value.trim());
  if (!match?.[1]) throw new Error(`Invalid HEX colour: ${value}`);
  return `#${match[1].toUpperCase()}`;
}
