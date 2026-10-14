/**
 * Builds the Maker Console listing pages (1920 x 960) as HTML from the plugin's real key renderer.
 *   node marketing.js <outDir> <logoPng>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { deviceKey, gainKey, macroKey, muteKey, presetKey, routeKey, scriptKey, statusKey } from "./render/svg";
import type { Channel } from "./vm/state";

const outDir = process.argv[2];
const logo = readFileSync(process.argv[3]).toString("base64");

function ch(p: Partial<Channel> & { label: string }): Channel {
  return { kind: "strip", index: 0, defaultName: p.label, physical: true, gain: 0, mute: false, solo: false, mono: false, routes: [true, false, false, true, false], deviceName: "", meter: [0, 2], levelDb: -60, ...p };
}
const voice = ch({ label: "VOICE", gain: -21, levelDb: -14 });
const games = ch({ label: "GAMES", index: 1, gain: -21, levelDb: -8 });
const music = ch({ label: "MUSIC/INTERNET", index: 2, gain: -22, levelDb: -4, physical: false });
const desktop = ch({ label: "Desktop", index: 3, physical: false, mute: true });
const a1 = ch({ kind: "bus", label: "A1", index: 0, deviceName: "Speakers (PRO X 2 LIGHTSPEED)", levelDb: -10 });

const img = (uri: string, size: number) => `<img src="${uri}" width="${size}" height="${size}" style="border-radius:${size * 0.12}px;display:block">`;
const keys = {
  voice: muteKey(voice, true),
  gamesMuted: muteKey(ch({ ...games, mute: true }), true),
  music: muteKey(music, true),
  desktop: muteKey(desktop, true),
  ptt: muteKey(ch({ ...voice, mute: true }), true, true),
  gain: gainKey(music, true, 0, -60),
  headset: deviceKey(a1, "Headset", true, "A1 · tap to swap"),
  speakers: deviceKey(a1, "Speakers", false, "A1 · tap to swap"),
  route: routeKey(voice, "B1", true),
  routeOff: routeKey(games, "B1", false),
  macro: macroKey(3, true, "Stream mix"),
  script: scriptKey("Night mode", true),
  preset: presetKey("Preset 1"),
  status: statusKey(true, true, "Voicemeeter Banana", "2.1.2.2", ""),
};

// Touch-strip mock (200x100, scaled).
const seg = (inner: string, scale: number) => `<div class="seg" style="transform:scale(${scale})">${inner}</div>`;
const txt = (x: number, y: number, w: number, size: number, color: string, s: string, weight = 700, align = "left") =>
  `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;font-size:${size}px;color:${color};font-weight:${weight};text-align:${align};white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${s}</div>`;
const bar = (x: number, y: number, w: number, h: number, pct: number, color: string, bg = "#2a2e35") =>
  `<div style="position:absolute;left:${x}px;top:${y}px;width:${w}px;height:${h}px;background:${bg}"><div style="width:${pct}%;height:100%;background:${color}"></div></div>`;
const dial = (label: string, db: string, dbColor: string, gainPct: number, hotPct: number, base: string, hot: string, levelPct: number, levelColor: string, scale = 1.6) =>
  seg(txt(8, 6, 184, 13, "#9aa0a6", label) + txt(8, 30, 184, 22, dbColor, db, 800, "center") + bar(8, 66, 151, 10, gainPct, base) + bar(160, 63, 3, 16, 100, "#5f6368", "#5f6368") + bar(164, 66, 28, 10, hotPct, hot) + bar(8, 82, 184, 10, levelPct, levelColor, "#1b1e24"), scale);

const page = (body: string) => `<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;width:1920px;height:960px;overflow:hidden;background:#0f0f0f;font-family:"Segoe UI",Helvetica,Arial,sans-serif;color:#fff}
  .bg{position:absolute;inset:0;background:radial-gradient(1200px 700px at 30% 40%,#0b2a33 0%,#0f0f0f 60%)}
  .wrap{position:relative;width:1920px;height:960px}
  h1{font-size:96px;font-weight:800;margin:0;letter-spacing:-2px;line-height:1}
  h2{font-size:64px;font-weight:800;margin:0 0 18px;letter-spacing:-1px}
  p{font-size:34px;color:#b3b3b3;margin:0;line-height:1.35}
  .row{display:flex;gap:28px}.col{display:flex;flex-direction:column;gap:28px}
  .seg{position:relative;width:200px;height:100px;background:#101114;border-radius:8px;transform-origin:top left;font-family:"Segoe UI",Arial,sans-serif}
  .dialk{width:120px;height:120px;border-radius:50%;background:radial-gradient(circle at 40% 35%,#3a3a3a,#111 70%);border:4px solid #333;margin:0 auto}
  .feature{display:flex;gap:22px;align-items:flex-start}.feature .dot{width:18px;height:18px;border-radius:50%;background:#22c1e8;margin-top:16px;flex:none}
  .feature b{font-size:36px;display:block;margin-bottom:6px}.feature span{font-size:28px;color:#b3b3b3;line-height:1.35}
</style></head><body><div class="wrap"><div class="bg"></div>${body}</div></body></html>`;
const deck = (list: string[], size = 150) => `<div class="col">${[0, 1].map((r) => `<div class="row">${list.slice(r * 4, r * 4 + 4).map((k) => img(k, size)).join("")}</div>`).join("")}</div>`;

const pages: Record<string, string> = {
  "thumbnail.html": page(`
    <div style="position:absolute;left:120px;top:150px;width:900px">
      <div style="display:flex;align-items:center;gap:36px;margin-bottom:40px"><img src="data:image/png;base64,${logo}" width="160" height="160" style="border-radius:36px"><h1>Simply<br>Voicemeeter</h1></div>
      <p>Voicemeeter on your Stream Deck, live. Meters on every mute, one-tap output swapping, dials that show the truth.</p>
      <p style="font-size:24px;color:#6a6a6a;margin-top:28px">Not affiliated with VB-Audio.</p>
    </div>
    <div style="position:absolute;right:120px;top:120px">${deck([keys.voice, keys.gamesMuted, keys.music, keys.headset, keys.gain, keys.route, keys.macro, keys.status], 160)}</div>
    <div style="position:absolute;left:1076px;top:530px" class="row" style="gap:20px">${dial("MUSIC/INTERNET", "-4 dB", "#fff", 93, 0, "#22c1e8", "#e84922", 93, "#ffc53d", 1.1)}<div style="width:230px"></div>${dial("GAMES", "+3 dB", "#e84922", 100, 25, "#22c1e8", "#e84922", 86, "#3ad47e", 1.1)}</div>`),

  "gallery-1.html": page(`
    <div style="position:absolute;left:120px;top:120px;width:760px">
      <h2>Every key is live</h2>
      <p>Mute keys show the real state and a level meter, so you can see the mic is hot. Gain keys read dB back from Voicemeeter. Output Device swaps a bus between headset and speakers and lights up for whichever is live.</p>
    </div>
    <div style="position:absolute;right:120px;top:120px">${deck([keys.voice, keys.gamesMuted, keys.music, keys.desktop, keys.headset, keys.speakers, keys.gain, keys.ptt], 170)}</div>
    <div style="position:absolute;left:120px;bottom:110px" class="row">${[keys.route, keys.routeOff, keys.macro, keys.script, keys.preset, keys.status].map((k) => img(k, 140)).join("")}</div>`),

  "gallery-2.html": page(`
    <div style="position:absolute;left:120px;top:120px;width:760px">
      <h2>Built for Stream Deck +</h2>
      <p>A gain dial per strip or bus: label, dB, a gain bar in the color you pick with a hot segment above 0 dB in its complement, and a live meter. Rotate for gain, press for solo, tap for mute.</p>
    </div>
    <div style="position:absolute;left:930px;top:150px" class="col">
      <div class="row" style="gap:40px">${dial("VOICE", "-21 dB", "#fff", 65, 0, "#22c1e8", "#e84922", 77, "#3ad47e", 1.5)}<div style="width:220px"></div>${dial("GAMES", "+3 dB", "#d53990", 100, 25, "#3ad47e", "#d53990", 86, "#3ad47e", 1.5)}</div>
      <div style="height:150px"></div>
      <div class="row" style="gap:40px">${dial("MUSIC/INTERNET", "-4 dB", "#fff", 93, 0, "#b06cff", "#a1ff33", 93, "#ffc53d", 1.9)}<div style="width:220px"></div>${dial("A1 · Headset", "0 dB  ·  SOLO", "#fff", 100, 0, "#ffc53d", "#3370ff", 83, "#3ad47e", 1.5)}</div>
      <div style="height:150px"></div>
      <div class="row" style="justify-content:space-around;width:840px"><div class="dialk"></div><div class="dialk"></div><div class="dialk"></div><div class="dialk"></div></div>
    </div>`),

  "gallery-3.html": page(`
    <div style="position:absolute;left:120px;top:110px;width:840px">
      <h2 style="font-size:60px">Pick by name,<br>never by index</h2>
      <div class="col" style="gap:26px;margin-top:24px">
        <div class="feature"><div class="dot"></div><div><b>Voicemeeter's own labels</b><span>Dropdowns list VOICE, GAMES and MUSIC, not Strip 0, 1, 2. Output devices come from Voicemeeter's device list.</span></div></div>
        <div class="feature"><div class="dot"></div><div><b>Official Remote API</b><span>Talks to VoicemeeterRemote64.dll directly. Keys follow changes you make in Voicemeeter within a tenth of a second.</span></div></div>
        <div class="feature"><div class="dot"></div><div><b>Scripts you already know</b><span>Strip[0].Mute=1; Bus[0].Gain=-6; Press, hold, toggle or push-to-talk, with live state from any parameter.</span></div></div>
        <div class="feature"><div class="dot"></div><div><b>Free and open source</b><span>MIT on GitHub. Voicemeeter, Banana and Potato on Windows.</span></div></div>
      </div>
    </div>
    <div style="position:absolute;right:120px;top:190px">${deck([keys.headset, keys.speakers, keys.script, keys.preset, keys.macro, keys.route, keys.voice, keys.status], 160)}</div>`),
};

for (const [name, html] of Object.entries(pages)) writeFileSync(join(outDir, name), html);
console.log(`wrote ${Object.keys(pages).length} pages to ${outDir}`);
process.exit(0);
