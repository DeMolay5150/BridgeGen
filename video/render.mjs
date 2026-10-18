/**
 * Renders the BridgeGen walkthrough (src/Walkthrough.tsx) to MP4.
 *
 *   pnpm render                          # full video → out/walkthrough.mp4
 *   pnpm render --out ../public/walkthrough.mp4
 *   pnpm render --still 40               # one frame at 0:40 → out/still-40s.png
 *   pnpm render --still 6,40,95          # several frames, one bundle
 *   pnpm render --frames 0-299           # a frame range, for quick checks
 *   pnpm render --scale 0.5              # half resolution draft
 *
 * Figures come from the app's engines (src/data.ts imports ../lib), so a
 * render always matches the product.
 *
 * Browser: uses REMOTION_BROWSER_EXECUTABLE if set, else Playwright's
 * chrome-headless-shell if installed (the repo's e2e test installs it); only
 * otherwise does Remotion fetch its own on first run.
 *
 * Licence: Remotion is free for individuals and companies of up to three
 * people; larger companies need a Remotion company licence (remotion.pro).
 */
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { createServer } from "node:net";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { bundle } from "@remotion/bundler";
import { renderMedia, renderStill, selectComposition } from "@remotion/renderer";

const here = dirname(fileURLToPath(import.meta.url));
const { values: args } = parseArgs({
  options: {
    out: { type: "string" },
    still: { type: "string" },
    frames: { type: "string" },
    scale: { type: "string", default: "1" },
  },
});

function findBrowser() {
  if (process.env.REMOTION_BROWSER_EXECUTABLE) return process.env.REMOTION_BROWSER_EXECUTABLE;
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH || (process.env.LOCALAPPDATA && join(process.env.LOCALAPPDATA, "ms-playwright"));
  if (!root || !existsSync(root)) return null;
  const shells = readdirSync(root).filter((d) => d.startsWith("chromium_headless_shell-")).sort().reverse();
  for (const dir of shells) {
    for (const exe of ["chrome-headless-shell-win64/chrome-headless-shell.exe", "chrome-headless-shell-linux64/chrome-headless-shell", "chrome-headless-shell-mac-arm64/chrome-headless-shell"]) {
      const path = join(root, dir, exe);
      if (existsSync(path)) return path;
    }
  }
  return null;
}

/**
 * A port the OS says is free. Remotion starts probing at 3000, where `pnpm dev`
 * usually runs, and on dual-stack Windows can end up loading the Next app.
 */
const freePort = () =>
  new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });

const scale = Number(args.scale);
if (!(scale > 0 && scale <= 1)) throw new Error("--scale must be between 0 and 1");
const browserExecutable = findBrowser();
console.log(`Browser: ${browserExecutable ?? "Remotion-managed (downloaded on first run)"}`);

console.log("Bundling…");
const serveUrl = await bundle({ entryPoint: join(here, "src/index.ts") });
const port = Number(process.env.REMOTION_PORT) || (await freePort());
const composition = await selectComposition({ serveUrl, id: "Walkthrough", browserExecutable, port });
const { fps, durationInFrames } = composition;
console.log(`Walkthrough: ${(durationInFrames / fps).toFixed(1)}s, ${durationInFrames} frames at ${fps} fps, ${composition.width}×${composition.height}`);

mkdirSync(join(here, "out"), { recursive: true });

if (args.still !== undefined) {
  const times = args.still.split(",").map(Number);
  if (times.some((s) => !Number.isFinite(s) || s < 0)) throw new Error("--still takes seconds, e.g. 40 or 6,40,95");
  for (const seconds of times) {
    const frame = Math.min(durationInFrames - 1, Math.round(seconds * fps));
    const output = resolve(times.length === 1 && args.out ? args.out : join(here, "out", `still-${seconds}s.png`));
    await renderStill({ serveUrl, composition, frame, output, scale, browserExecutable, port });
    console.log(`Still at ${seconds}s (frame ${frame}) → ${output}`);
  }
} else {
  const output = resolve(args.out ?? join(here, "out", "walkthrough.mp4"));
  mkdirSync(dirname(output), { recursive: true });
  const frameRange = args.frames ? /** @type {[number, number]} */ (args.frames.split("-").map(Number)) : null;
  let last = -1;
  await renderMedia({
    serveUrl,
    composition,
    codec: "h264",
    crf: 18,
    outputLocation: output,
    frameRange,
    scale,
    browserExecutable,
    port,
    onProgress: ({ progress }) => {
      const pct = Math.floor(progress * 100);
      if (pct >= last + 5) {
        last = pct;
        console.log(`Rendering… ${pct}%`);
      }
    },
  });
  console.log(`Video → ${output}`);
}
