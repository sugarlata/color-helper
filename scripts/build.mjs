import { build } from "esbuild";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const requested = process.argv[2];
const browsers = requested ? [requested] : ["chrome", "firefox"];
if (browsers.some((browser) => !["chrome", "firefox"].includes(browser))) {
  throw new Error("Build target must be chrome or firefox.");
}

for (const browser of browsers) {
  const output = resolve(root, "dist", browser);
  await rm(output, { recursive: true, force: true });
  await mkdir(resolve(output, "options"), { recursive: true });
  await mkdir(resolve(output, "icons"), { recursive: true });

  const common = {
    bundle: true,
    minify: false,
    sourcemap: true,
    target: browser === "chrome" ? "chrome120" : "firefox126",
    platform: "browser",
    logLevel: "info",
  };
  await Promise.all([
    build({ ...common, entryPoints: [resolve(root, "src/background/index.ts")], outfile: resolve(output, "background.js"), format: "iife" }),
    build({ ...common, entryPoints: [resolve(root, "src/content/index.ts")], outfile: resolve(output, "content.js"), format: "iife" }),
    build({ ...common, entryPoints: [resolve(root, "src/options/index.ts")], outfile: resolve(output, "options/index.js"), format: "iife" }),
  ]);
  await Promise.all([
    cp(resolve(root, "src/options/index.html"), resolve(output, "options/index.html")),
    cp(resolve(root, "src/options/styles.css"), resolve(output, "options/styles.css")),
    cp(resolve(root, "assets/icons"), resolve(output, "icons"), { recursive: true }),
  ]);
  const manifest = JSON.parse(await readFile(resolve(root, "manifests", `${browser}.json`), "utf8"));
  const pkg = JSON.parse(await readFile(resolve(root, "package.json"), "utf8"));
  manifest.version = pkg.version;
  await writeFile(resolve(output, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
}
