/**
 * Marketplace logo: three flat faders on the suite's dark rounded square, accent cyan knobs. Rendered by headless
 * Chrome from an SVG. Writes imgs/plugin/marketplace.png (288) and marketplace@2x.png (576).
 */
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(root, "com.mjp.simplyvoicemeeter.sdPlugin", "imgs", "plugin");
const tmp = join(root, "assets", "logo");
mkdirSync(tmp, { recursive: true });
mkdirSync(out, { recursive: true });

function svg(size) {
  const s = size / 576;
  const track = (x) => `<rect x="${x * s}" y="${120 * s}" width="${22 * s}" height="${336 * s}" rx="${11 * s}" fill="#2a2e35"/>`;
  const knob = (x, y) => `<rect x="${(x - 40) * s}" y="${(y - 30) * s}" width="${102 * s}" height="${60 * s}" rx="${16 * s}" fill="#22c1e8"/><rect x="${(x - 2) * s}" y="${(y - 14) * s}" width="${26 * s}" height="${28 * s}" rx="${3 * s}" fill="#101114" opacity="0.55"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${size * 0.22}" fill="#121212"/>
  ${track(137)}${track(277)}${track(417)}
  ${knob(137, 236)}${knob(277, 356)}${knob(417, 196)}
</svg>`;
}

const chrome = ["C:/Program Files/Google/Chrome/Application/chrome.exe", "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe"].find(existsSync);
if (!chrome) throw new Error("Chrome not found");
for (const [size, name] of [[576, "marketplace@2x.png"], [288, "marketplace.png"]]) {
  const html = join(tmp, `logo-${size}.html`);
  writeFileSync(html, `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:transparent;width:${size}px;height:${size}px;overflow:hidden}</style></head><body>${svg(size)}</body></html>`);
  const png = join(out, name);
  execFileSync(chrome, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--default-background-color=00000000", `--window-size=${size},${size}`, `--screenshot=${png}`, `file:///${html.replace(/\\/g, "/")}`], { stdio: "ignore" });
  console.log(`wrote ${png}`);
}
writeFileSync(join(tmp, "logo.svg"), svg(576));
