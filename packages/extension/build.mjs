import { build, context } from "esbuild";
import { cp, rm, mkdir } from "node:fs/promises";

const watch = process.argv.includes("--watch");

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

const options = {
  entryPoints: {
    content: "src/content.ts",
    background: "src/background.ts",
    popup: "src/popup.ts",
  },
  bundle: true,
  format: "iife",
  target: "chrome110",
  outdir: "dist",
  tsconfig: "tsconfig.json",
  logLevel: "info",
};

async function copyStatic() {
  await cp("manifest.json", "dist/manifest.json");
  await cp("src/popup.html", "dist/popup.html");
}

if (watch) {
  const ctx = await context(options);
  await ctx.watch();
  await copyStatic();
  console.log("watching… (load dist/ as an unpacked extension)");
} else {
  await build(options);
  await copyStatic();
  console.log("built → dist/ (load as unpacked extension in chrome://extensions)");
}
