import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import "./build.mjs";

const root = resolve(import.meta.dirname, "..");
await mkdir(resolve(root, "packages"), { recursive: true });
await Promise.all([
  rm(resolve(root, "packages", "colour-palette-matcher-chrome.zip"), { force: true }),
  rm(resolve(root, "packages", "colour-palette-matcher-firefox.xpi"), { force: true }),
]);
for (const browser of ["chrome", "firefox"]) {
  const extension = browser === "firefox" ? "xpi" : "zip";
  const destination = resolve(root, "packages", `color-palette-helper-${browser}.${extension}`);
  await rm(destination, { force: true });
  const result = spawnSync("zip", ["-qr", destination, "."], { cwd: resolve(root, "dist", browser), stdio: "inherit" });
  if (result.status !== 0) throw new Error(`Could not package ${browser}; ensure the zip command is installed.`);

  const extracted = resolve(root, "packages", `color-palette-helper-${browser}`);
  await rm(extracted, { recursive: true, force: true });
  await mkdir(extracted, { recursive: true });
  const extraction = spawnSync("unzip", ["-oq", destination, "-d", extracted], { stdio: "inherit" });
  if (extraction.status !== 0) throw new Error(`Could not extract the ${browser} package; ensure the unzip command is installed.`);
}
