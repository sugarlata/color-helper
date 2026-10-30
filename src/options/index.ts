import { normalizeHex } from "../shared/color";
import { loadData, saveData } from "../palettes/storage";
import { CURRENT_PALETTE_SCHEMA_VERSION, parsePaletteJson, serializePaletteJson, validatePalette } from "../palettes/schema";
import type { ColorPalette, PaletteColor, StoredData } from "../shared/types";
import { queryActiveTab, sendTabMessage } from "../shared/webext";

const select = document.querySelector<HTMLSelectElement>("#palette-select")!;
const activeSelect = document.querySelector<HTMLSelectElement>("#active-palette-select")!;
const nameInput = document.querySelector<HTMLInputElement>("#name")!;
const descriptionInput = document.querySelector<HTMLInputElement>("#description")!;
const systemInput = document.querySelector<HTMLInputElement>("#system")!;
const diameterInput = document.querySelector<HTMLInputElement>("#diameter")!;
const thicknessInput = document.querySelector<HTMLInputElement>("#thickness")!;
const opacityInput = document.querySelector<HTMLInputElement>("#opacity")!;
const rotationInput = document.querySelector<HTMLInputElement>("#rotation")!;
const coloursContainer = document.querySelector<HTMLDivElement>("#colours")!;
const colourCount = document.querySelector<HTMLParagraphElement>("#colour-count")!;
const status = document.querySelector<HTMLParagraphElement>("#status")!;
const fileInput = document.querySelector<HTMLInputElement>("#file")!;

let data: StoredData;
let editing: ColorPalette;
let draggedColorIndex: number | null = null;

const clone = <T>(value: T): T => structuredClone(value);
const slug = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "colour";

function uniqueId(base: string, existing: Iterable<string>): string {
  const ids = new Set(existing);
  if (!ids.has(base)) return base;
  let suffix = 2;
  while (ids.has(`${base}-${suffix}`)) suffix += 1;
  return `${base}-${suffix}`;
}

function currentPalette(): ColorPalette {
  return data.palettes.find((palette) => palette.id === select.value) ?? data.palettes[0]!;
}

function refreshSelect(id: string): void {
  const options = () => data.palettes.map((palette) => new Option(palette.name, palette.id));
  select.replaceChildren(...options());
  select.value = id;
  activeSelect.replaceChildren(...options());
  activeSelect.value = data.activePaletteId;
}

function loadEditor(palette: ColorPalette): void {
  editing = clone(palette);
  nameInput.value = editing.name;
  descriptionInput.value = editing.description ?? "";
  systemInput.value = editing.system ?? "";
  diameterInput.value = String(data.matcherSettings.diameter);
  thicknessInput.value = String(data.matcherSettings.thickness);
  opacityInput.value = String(data.matcherSettings.opacity);
  rotationInput.value = String(data.matcherSettings.rotation);
  renderColours();
  status.textContent = "";
}

function renderColours(): void {
  colourCount.textContent = `${editing.colors.length.toLocaleString()} colours`;
  coloursContainer.replaceChildren(...editing.colors.map((color, index) => colourRow(color, index)));
}

function moveColor(from: number, to: number): void {
  if (from === to || to < 0 || to >= editing.colors.length) return;
  const [color] = editing.colors.splice(from, 1);
  if (!color) return;
  editing.colors.splice(to, 0, color);
  renderColours();
  coloursContainer.children[to]?.querySelector<HTMLButtonElement>(".drag-handle")?.focus();
}

function colourRow(color: PaletteColor, index: number): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "colour-row";
  const dragHandle = document.createElement("button");
  dragHandle.type = "button";
  dragHandle.className = "drag-handle";
  dragHandle.textContent = "⠿";
  dragHandle.draggable = true;
  dragHandle.title = "Drag to reorder";
  dragHandle.setAttribute("aria-label", `Reorder ${color.name}. Use drag and drop or the up and down arrow keys.`);
  dragHandle.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    moveColor(index, index + (event.key === "ArrowUp" ? -1 : 1));
  });
  dragHandle.addEventListener("dragstart", (event) => {
    draggedColorIndex = index;
    row.classList.add("dragging");
    event.dataTransfer?.setData("text/plain", String(index));
    if (event.dataTransfer) event.dataTransfer.effectAllowed = "move";
  });
  dragHandle.addEventListener("dragend", () => {
    draggedColorIndex = null;
    row.classList.remove("dragging");
    coloursContainer.querySelectorAll(".drag-over").forEach((item) => item.classList.remove("drag-over"));
  });
  row.addEventListener("dragover", (event) => {
    if (draggedColorIndex === null) return;
    event.preventDefault();
    row.classList.add("drag-over");
    if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  });
  row.addEventListener("dragleave", () => row.classList.remove("drag-over"));
  row.addEventListener("drop", (event) => {
    event.preventDefault();
    row.classList.remove("drag-over");
    if (draggedColorIndex === null) return;
    const from = draggedColorIndex;
    const belowMidpoint = event.clientY > row.getBoundingClientRect().top + row.getBoundingClientRect().height / 2;
    let insertionIndex = index + (belowMidpoint ? 1 : 0);
    const [dragged] = editing.colors.splice(from, 1);
    if (!dragged) return;
    if (from < insertionIndex) insertionIndex -= 1;
    insertionIndex = Math.max(0, Math.min(editing.colors.length, insertionIndex));
    editing.colors.splice(insertionIndex, 0, dragged);
    draggedColorIndex = null;
    renderColours();
  });
  const picker = document.createElement("input");
  picker.type = "color";
  picker.value = color.hex;
  picker.title = `${color.name} colour picker`;
  const name = document.createElement("input");
  name.value = color.name;
  name.setAttribute("aria-label", `Colour ${index + 1} name`);
  const hex = document.createElement("input");
  hex.className = "hex";
  hex.value = color.hex;
  hex.setAttribute("aria-label", `Colour ${index + 1} HEX value`);
  picker.addEventListener("input", () => { hex.value = picker.value.toUpperCase(); color.hex = hex.value; });
  hex.addEventListener("input", () => {
    try { color.hex = normalizeHex(hex.value); picker.value = color.hex; } catch { /* Validated on save. */ }
  });
  name.addEventListener("input", () => { color.name = name.value; });
  const actions = document.createElement("div");
  actions.className = "row-actions";
  const action = (label: string, title: string, handler: () => void) => {
    const button = document.createElement("button");
    button.type = "button"; button.textContent = label; button.title = title; button.setAttribute("aria-label", `${title} ${color.name}`);
    button.addEventListener("click", handler); return button;
  };
  actions.append(
    action("×", "Remove", () => { editing.colors.splice(index, 1); renderColours(); }),
  );
  const star = document.createElement("button");
  star.type = "button";
  star.className = "star";
  star.setAttribute("aria-label", `Mark ${color.name} as a stronger colour`);
  const updateStar = () => {
    star.textContent = color.highlighted ? "★" : "☆";
    star.setAttribute("aria-pressed", String(Boolean(color.highlighted)));
    star.title = color.highlighted ? "Remove stronger-colour highlight" : "Mark as stronger colour";
  };
  star.addEventListener("click", () => { color.highlighted = !color.highlighted; updateStar(); });
  updateStar();
  row.append(dragHandle, picker, name, hex, star, actions);
  return row;
}

function updateEditingFromFields(): void {
  editing.name = nameInput.value.trim();
  editing.description = descriptionInput.value.trim();
  editing.system = systemInput.value.trim();
}

async function notifyPage(): Promise<void> {
  try {
    const tab = await queryActiveTab();
    if (tab.id !== undefined) await sendTabMessage(tab.id, { type: "palette-updated" });
  } catch { /* No matcher is running on the current page. */ }
}

select.addEventListener("change", () => loadEditor(currentPalette()));

activeSelect.addEventListener("change", async () => {
  data.activePaletteId = activeSelect.value;
  await saveData(data);
  const active = data.palettes.find((palette) => palette.id === data.activePaletteId);
  status.textContent = `“${active?.name ?? "Palette"}” is now used by the dial.`;
  await notifyPage();
});

document.querySelector("#add-colour")!.addEventListener("click", () => {
  editing.colors.push({ name: "New colour", hex: "#808080" });
  renderColours();
  coloursContainer.lastElementChild?.scrollIntoView({ behavior: "smooth", block: "center" });
});

document.querySelector("#new-palette")!.addEventListener("click", () => {
  const id = uniqueId("new-palette", data.palettes.map((palette) => palette.id));
  const palette: ColorPalette = { schemaVersion: CURRENT_PALETTE_SCHEMA_VERSION, id, name: "New palette", colors: [{ name: "First colour", hex: "#808080" }] };
  data.palettes.push(palette);
  refreshSelect(id);
  loadEditor(palette);
});

document.querySelector("#delete")!.addEventListener("click", async () => {
  if (data.palettes.length === 1) { status.textContent = "At least one palette must remain."; return; }
  if (!confirm(`Delete “${editing.name}”? This cannot be undone.`)) return;
  data.palettes = data.palettes.filter((palette) => palette.id !== editing.id);
  if (data.activePaletteId === editing.id) data.activePaletteId = data.palettes[0]!.id;
  await saveData(data);
  refreshSelect(data.activePaletteId);
  loadEditor(currentPalette());
  await notifyPage();
});

document.querySelector("#import")!.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", async () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  const result = parsePaletteJson(await file.text());
  if (!result.valid || !result.palette) { status.textContent = result.errors.join(" "); return; }
  if (data.palettes.some((palette) => palette.id === result.palette!.id)) {
    status.textContent = `A palette with id “${result.palette.id}” already exists. Change its id in the JSON or delete the existing palette first.`;
    return;
  }
  data.palettes.push(result.palette);
  await saveData(data);
  refreshSelect(result.palette.id);
  loadEditor(result.palette);
  status.textContent = result.migratedFromVersion === undefined
    ? `Imported ${result.palette.colors.length} colours.`
    : `Imported ${result.palette.colors.length} colours and upgraded schema version ${result.migratedFromVersion} to ${result.palette.schemaVersion}.`;
  fileInput.value = "";
});

document.querySelector("#export")!.addEventListener("click", () => {
  updateEditingFromFields();
  let json: string;
  try { json = serializePaletteJson(editing); }
  catch (error) { status.textContent = error instanceof Error ? error.message : String(error); return; }
  const blob = new Blob([json], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = `${slug(editing.name)}.json`; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
});

document.querySelector("#save")!.addEventListener("click", async () => {
  updateEditingFromFields();
  const result = validatePalette(editing);
  if (!result.valid || !result.palette) { status.textContent = result.errors.join(" "); return; }
  const diameter = Number(diameterInput.value);
  const thickness = Number(thicknessInput.value);
  const opacity = Number(opacityInput.value);
  const rotation = Number(rotationInput.value);
  if (!Number.isFinite(diameter) || diameter < 80 || diameter > 800) { status.textContent = "Diameter must be from 80 to 800 pixels."; return; }
  if (!Number.isFinite(thickness) || thickness < 5 || thickness >= diameter / 2) { status.textContent = "Ring width must be at least 5 pixels and less than half the diameter."; return; }
  if (!Number.isFinite(opacity) || opacity < 0.1 || opacity > 1) { status.textContent = "Opacity must be from 0.1 to 1."; return; }
  if (!Number.isFinite(rotation) || rotation < 0 || rotation > 360) { status.textContent = "Dial rotation must be from 0 to 360 degrees."; return; }
  const index = data.palettes.findIndex((palette) => palette.id === editing.id);
  data.palettes[index] = result.palette;
  data.matcherSettings = { diameter, thickness, opacity, rotation };
  await saveData(data);
  refreshSelect(editing.id);
  loadEditor(result.palette);
  status.textContent = "Saved.";
  await notifyPage();
});

const tabs = [
  { tab: document.querySelector<HTMLButtonElement>("#general-tab")!, panel: document.querySelector<HTMLElement>("#general-panel")! },
  { tab: document.querySelector<HTMLButtonElement>("#palettes-tab")!, panel: document.querySelector<HTMLElement>("#palettes-panel")! },
];

function selectTab(index: number): void {
  tabs.forEach((item, itemIndex) => {
    const selected = itemIndex === index;
    item.tab.setAttribute("aria-selected", String(selected));
    item.tab.tabIndex = selected ? 0 : -1;
    item.panel.hidden = !selected;
  });
  tabs[index]!.tab.focus();
}

tabs.forEach((item, index) => {
  item.tab.addEventListener("click", () => selectTab(index));
  item.tab.addEventListener("keydown", (event) => {
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
    event.preventDefault();
    selectTab((index + (event.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length);
  });
});

void (async () => {
  data = await loadData();
  refreshSelect(data.activePaletteId);
  loadEditor(currentPalette());
})();
