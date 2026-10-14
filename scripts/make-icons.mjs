/** Generates action icons and default keys (SVG) plus the category icon. The marketplace PNG comes from make-logo.mjs. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const plugin = join(root, "com.mjp.simplyvoicemeeter.sdPlugin");
const BG = "#101114";
const ACCENT = "#22c1e8";

// Stroke glyphs on a 144 grid (kept in sync by hand with src/render/svg.ts).
const glyphs = {
  mute: "M28 56h20l24-20v72L48 88H28zM88 52a26 26 0 0 1 0 40M102 40a44 44 0 0 1 0 64",
  gain: "M72 24v96M50 62h44v20H50z",
  device: "M30 84V72a42 42 0 0 1 84 0v12M30 84h18v28H30zM96 84h18v28H96zM72 118h22",
  route: "M28 44h36l24 28h28M28 100h36l24-28",
  macro: "M30 40h84v64H30zM52 52v40M72 52v40M92 52v40",
  script: "M38 28h50l18 18v70H38zM50 64h44M50 80h44M50 96h30",
  preset: "M30 40h84v20H30zM30 72h84v20H30zM30 104h52v12H30z",
  status: "M28 44l16 56 16-56M72 100V44l12 32 12-32v56",
};
const labels = {
  mute: ["Mute", ""],
  gain: ["Gain", ""],
  device: ["Output", "device"],
  route: ["Route", ""],
  macro: ["Macro", "button"],
  script: ["Script", ""],
  preset: ["Preset", ""],
  status: ["Voicemeeter", ""],
};
const path = (d, color, w = 10) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;

for (const [name, d] of Object.entries(glyphs)) {
  const dir = join(plugin, "imgs/actions", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "icon.svg"), `<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 144 144"><g transform="translate(14 14) scale(0.8)">${path(d, "#ffffff", 12)}</g></svg>`);
  const [l1, l2] = labels[name];
  writeFileSync(
    join(dir, "key.svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144"><rect width="144" height="144" rx="14" fill="${BG}"/><g transform="translate(42 14) scale(0.42)">${path(d, ACCENT)}</g><text x="72" y="104" text-anchor="middle" font-size="${l1.length > 8 ? 15 : 18}" font-weight="700" fill="#ffffff" font-family="Segoe UI, Arial, sans-serif">${l1}</text><text x="72" y="126" text-anchor="middle" font-size="13" fill="#9aa0a6" font-family="Segoe UI, Arial, sans-serif">${l2}</text></svg>`,
  );
}
mkdirSync(join(plugin, "imgs/plugin"), { recursive: true });
// Category icon: three faders, monochrome.
writeFileSync(
  join(plugin, "imgs/plugin/category-icon.svg"),
  `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 144 144"><g fill="#ffffff"><rect x="30" y="24" width="8" height="96" rx="4"/><rect x="68" y="24" width="8" height="96" rx="4"/><rect x="106" y="24" width="8" height="96" rx="4"/><rect x="18" y="52" width="32" height="18" rx="5"/><rect x="56" y="84" width="32" height="18" rx="5"/><rect x="94" y="38" width="32" height="18" rx="5"/></g></svg>`,
);
console.log("icons written");
