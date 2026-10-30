import type { ColorPalette, MatcherSettings } from "../shared/types";

const ROOT_ID = "color-palette-helper-root";
const HIGHLIGHT_EXTENSION = 12;

export function segmentOuterRadius(baseDiameter: number, highlighted: boolean): number {
  return baseDiameter / 2 + (highlighted ? HIGHLIGHT_EXTENSION : 0);
}

export function segmentSeamOverlap(segmentAngle: number, innerRadius: number): number {
  // Canvas antialiases each wedge against transparency. A small overlap ensures
  // the next colour is always behind those edge pixels instead of the webpage.
  return Math.min(segmentAngle * 0.06, 0.75 / Math.max(1, innerRadius));
}

export function dialRotationRadians(degrees: number): number {
  return degrees * Math.PI / 180;
}

export class PageOverlay {
  private root: HTMLDivElement;
  private ring: HTMLCanvasElement;
  private lastX = window.innerWidth / 2;
  private lastY = window.innerHeight / 2;

  constructor() {
    document.getElementById(ROOT_ID)?.remove();
    this.root = document.createElement("div");
    this.root.id = ROOT_ID;
    Object.assign(this.root.style, {
      all: "initial", position: "fixed", inset: "0", zIndex: "2147483647", pointerEvents: "none",
    });
    this.ring = document.createElement("canvas");
    this.ring.setAttribute("aria-hidden", "true");
    Object.assign(this.ring.style, {
      display: "none", position: "fixed", left: "0", top: "0", pointerEvents: "none",
    });
    this.root.append(this.ring);
    document.documentElement.append(this.root);
  }

  renderRing(palette: ColorPalette, settings: MatcherSettings): void {
    const dpr = window.devicePixelRatio || 1;
    const baseSize = settings.diameter;
    const highlighted = palette.colors.some((color) => color.highlighted);
    const extension = highlighted ? HIGHLIGHT_EXTENSION : 0;
    const canvasSize = baseSize + extension * 2;
    this.ring.width = Math.ceil(canvasSize * dpr);
    this.ring.height = Math.ceil(canvasSize * dpr);
    this.ring.style.width = `${canvasSize}px`;
    this.ring.style.height = `${canvasSize}px`;
    this.ring.style.opacity = String(settings.opacity);
    const context = this.ring.getContext("2d");
    if (!context || palette.colors.length === 0) return;
    context.scale(dpr, dpr);
    context.clearRect(0, 0, canvasSize, canvasSize);
    const center = canvasSize / 2;
    const normalOuterRadius = baseSize / 2;
    const innerRadius = Math.max(0, normalOuterRadius - settings.thickness);
    const segmentAngle = Math.PI * 2 / palette.colors.length;
    const seamOverlap = segmentSeamOverlap(segmentAngle, innerRadius);
    const rotation = dialRotationRadians(settings.rotation);
    palette.colors.forEach((color, index) => {
      const start = -Math.PI / 2 + rotation + index * segmentAngle - seamOverlap;
      const end = -Math.PI / 2 + rotation + (index + 1) * segmentAngle + seamOverlap;
      const outerRadius = segmentOuterRadius(baseSize, Boolean(color.highlighted));
      context.beginPath();
      context.arc(center, center, outerRadius, start, end);
      context.arc(center, center, innerRadius, end, start, true);
      context.closePath();
      context.fillStyle = color.hex;
      context.fill();
    });
    this.ring.style.display = "block";
    this.positionRing(this.lastX, this.lastY);
  }

  positionRing(x: number, y: number): void {
    this.lastX = x;
    this.lastY = y;
    const width = Number.parseFloat(this.ring.style.width) || 0;
    this.ring.style.transform = `translate3d(${x - width / 2}px, ${y - width / 2}px, 0)`;
  }

  hideRing(): void { this.ring.style.display = "none"; }
}
