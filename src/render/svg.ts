/** Key images as SVG data URIs. */
import type { Channel } from "../vm/state";

export const BG = "#101114";
export const FG = "#ffffff";
export const MUTED = "#9aa0a6";
export const DIM = "#5f6368";
export const ACCENT = "#22c1e8";
export const RED = "#ff4f5e";
export const GREEN = "#3ad47e";
export const GOLD = "#ffc53d";
export const ORANGE = "#ff7a1a";
export const PURPLE = "#b06cff";

const FONT = `font-family="Segoe UI, Helvetica Neue, Arial, sans-serif"`;

export const escapeXml = (s: string): string => s.replace(/[<>&"']/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" })[c]!);
export const toDataUri = (svg: string): string => `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
export function fit(s: string, max: number): string {
  s = s.trim();
  return s.length > max ? s.slice(0, Math.max(1, max - 1)).trimEnd() + "…" : s;
}
export const fmtDb = (db: number): string => (db <= -60 ? "-∞" : `${db > 0 ? "+" : ""}${db.toFixed(db % 1 === 0 ? 0 : 1)}`) + " dB";

const wrap = (body: string, opacity = 1) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">${opacity < 1 ? `<g opacity="${opacity}">${body}</g>` : body}</svg>`;
const rect = (fill = BG) => `<rect width="144" height="144" rx="14" fill="${fill}"/>`;
const text = (x: number, y: number, size: number, fill: string, s: string, weight = 400, anchor = "middle") =>
  `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="${size}" font-weight="${weight}" fill="${fill}" ${FONT}>${escapeXml(s)}</text>`;
const ring = (color: string, w = 5) => `<rect x="${w / 2 + 1}" y="${w / 2 + 1}" width="${142 - w}" height="${142 - w}" rx="12" fill="none" stroke="${color}" stroke-width="${w}"/>`;
const glyph = (d: string, color: string, scale = 0.4, x = 43, y = 14, stroke = false) =>
  `<g transform="translate(${x} ${y}) scale(${scale})"><path d="${d}" fill="${stroke ? "none" : color}" ${stroke ? `stroke="${color}" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"` : ""}/></g>`;

export const glyphs = {
  speaker: "M28 56h20l24-20v72L48 88H28z",
  waves: "M88 52a26 26 0 0 1 0 40M102 40a44 44 0 0 1 0 64",
  cross: "M88 58l28 28M116 58L88 86",
  mic: "M72 24a16 16 0 0 1 16 16v28a16 16 0 0 1-32 0V40a16 16 0 0 1 16-16zM44 68a28 28 0 0 0 56 0M72 96v20M56 116h32",
  fader: "M72 24v96M50 62h44v20H50z",
  route: "M28 44h36l24 28h28M28 100h36l24-28",
  headset: "M30 84V72a42 42 0 0 1 84 0v12M30 84h18v28H30zM96 84h18v28H96zM72 118h22",
  macro: "M30 40h84v64H30zM52 52v40M72 52v40M92 52v40",
  script: "M38 28h50l18 18v70H38zM50 64h44M50 80h44M50 96h30",
  preset: "M30 40h84v20H30zM30 72h84v20H30zM30 104h52v12H30z",
  vm: "M28 44l16 56 16-56M72 100V44l12 32 12-32v56",
  power: "M72 26v46M46 44a38 38 0 1 0 52 0",
} as const;

export function iconSvg(d: string, color = FG, stroke = true): string {
  return toDataUri(`<svg xmlns="http://www.w3.org/2000/svg" width="144" height="144" viewBox="0 0 144 144">${glyph(d, color, 0.8, 14, 14, stroke)}</svg>`);
}

/** Horizontal VU bar: green to -12, gold to -3, red above. */
export function meter(db: number, y = 128, x = 8, w = 128, h = 8): string {
  const pct = Math.max(0, Math.min(1, (db + 60) / 60));
  const fill = db > -3 ? RED : db > -12 ? GOLD : GREEN;
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#ffffff" opacity="0.1"/><rect x="${x}" y="${y}" width="${Math.max(0, Math.round(w * pct))}" height="${h}" rx="${h / 2}" fill="${fill}"/>`;
}

const offline = (title: string, sub: string, color = DIM) => toDataUri(wrap(rect() + glyph(glyphs.vm, color, 0.42, 42, 14, true) + text(72, 102, 15, color, title, 700) + text(72, 124, 12, MUTED, sub), 0.9));

export function offlineKey(installed: boolean, connected: boolean, error: string): string | null {
  if (!installed) return offline("Not installed", fit(error || "Voicemeeter missing", 20), RED);
  if (!connected) return offline("Voicemeeter", "not running");
  return null;
}

export function muteKey(c: Channel | null, showMeter: boolean, ptt = false): string {
  if (!c) return offline("Mute", "pick a strip or bus");
  const on = c.mute;
  const color = on ? RED : ACCENT;
  const parts = [rect()];
  if (on) parts.push(ring(RED, 5));
  parts.push(text(72, 30, 13, MUTED, fit(c.label, 16), 700));
  const isMic = c.kind === "strip" && c.physical;
  if (isMic) parts.push(glyph(glyphs.mic, color, 0.42, 42, 32, true));
  else parts.push(glyph(glyphs.speaker, color, 0.42, 42, 32, false) + (on ? glyph(glyphs.cross, RED, 0.42, 42, 32, true) : glyph(glyphs.waves, color, 0.42, 42, 32, true)));
  parts.push(text(72, 112, 14, on ? RED : FG, on ? (ptt ? "hold to talk" : "MUTED") : ptt ? "live" : "on", 700));
  if (showMeter) parts.push(meter(on ? -60 : c.levelDb));
  return toDataUri(wrap(parts.join("")));
}

export function gainKey(c: Channel | null, showMeter: boolean, a: number, b: number): string {
  if (!c) return offline("Gain", "pick a strip or bus");
  const parts = [rect()];
  parts.push(text(72, 30, 13, MUTED, fit(c.label, 16), 700));
  parts.push(text(72, 80, 30, c.mute ? DIM : FG, fmtDb(c.gain), 800));
  parts.push(text(72, 108, 11, DIM, `${fmtDb(a)} · hold ${fmtDb(b)}`));
  if (showMeter) parts.push(meter(c.mute ? -60 : c.levelDb));
  return toDataUri(wrap(parts.join("")));
}

export function deviceKey(bus: Channel | null, label: string, active: boolean | null, sub: string, image?: string | null): string {
  if (!bus) return offline("Output", "pick a bus");
  if (image) {
    const parts = [`<image href="${image}" x="0" y="0" width="144" height="144" preserveAspectRatio="xMidYMid slice"/>`];
    if (active) parts.push(ring(ACCENT, 6));
    else parts.push(`<rect width="144" height="144" fill="#000" opacity="0.45"/>`);
    parts.push(text(72, 128, 13, FG, fit(label, 16), 700));
    return toDataUri(wrap(`<clipPath id="r"><rect width="144" height="144" rx="14"/></clipPath><g clip-path="url(#r)">${parts.join("")}</g>`));
  }
  const color = active ? ACCENT : DIM;
  return toDataUri(wrap(rect() + (active ? ring(ACCENT, 5) : "") + glyph(glyphs.headset, color, 0.42, 42, 14, true) + text(72, 104, 15, active ? FG : MUTED, fit(label, 14), 700) + text(72, 124, 11, MUTED, fit(sub, 20))));
}

export function routeKey(strip: Channel | null, bus: string, on: boolean): string {
  if (!strip) return offline("Route", "pick a strip");
  const color = on ? ACCENT : DIM;
  return toDataUri(wrap(rect() + (on ? ring(ACCENT, 4) : "") + text(72, 30, 13, MUTED, fit(strip.label, 16), 700) + glyph(glyphs.route, color, 0.4, 43, 32, true) + text(72, 112, 22, on ? FG : MUTED, bus, 800) + text(72, 130, 11, DIM, on ? "routed" : "off")));
}

export function macroKey(id: number, on: boolean | null, label: string): string {
  const color = on ? GOLD : DIM;
  return toDataUri(wrap(rect() + (on ? ring(GOLD, 4) : "") + glyph(glyphs.macro, color, 0.4, 43, 16, true) + text(72, 106, 15, on ? FG : MUTED, fit(label || `Macro ${id}`, 14), 700) + text(72, 126, 11, DIM, on === null ? "no macro buttons app" : on ? "on" : "off")));
}

export function scriptKey(label: string, on: boolean | null, image?: string | null): string {
  if (image) return toDataUri(wrap(`<clipPath id="r"><rect width="144" height="144" rx="14"/></clipPath><g clip-path="url(#r)"><image href="${image}" width="144" height="144" preserveAspectRatio="xMidYMid slice"/>${on ? ring(ACCENT, 6) : ""}</g>`));
  const color = on ? ACCENT : on === null ? MUTED : DIM;
  return toDataUri(wrap(rect() + (on ? ring(ACCENT, 4) : "") + glyph(glyphs.script, color, 0.4, 43, 16, true) + text(72, 108, 15, on === false ? MUTED : FG, fit(label || "Script", 14), 700) + text(72, 126, 11, DIM, on === null ? "" : on ? "on" : "off")));
}

export function presetKey(label: string): string {
  return toDataUri(wrap(rect() + glyph(glyphs.preset, PURPLE, 0.4, 43, 16, true) + text(72, 108, 15, FG, fit(label || "Preset", 14), 700) + text(72, 126, 11, DIM, "recall")));
}

export function statusKey(installed: boolean, connected: boolean, name: string, version: string, error: string): string {
  const off = offlineKey(installed, connected, error);
  if (off) return off;
  return toDataUri(wrap(rect() + glyph(glyphs.vm, GREEN, 0.42, 42, 14, true) + text(72, 102, 14, FG, fit(name.replace("Voicemeeter ", ""), 14), 700) + text(72, 124, 12, MUTED, version)));
}

export function placeholderKey(label: string, d: string, color = ACCENT): string {
  return wrap(rect() + glyph(d, color, 0.42, 42, 14, true) + text(72, 110, 16, FG, label, 700));
}
