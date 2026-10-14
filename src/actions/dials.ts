/** Stream Deck + dial: gain for a strip or bus with a live meter on the touch strip. */
import { action, type DialDownEvent, type DialRotateEvent, type TouchTapEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { ACCENT, DIM, FG, fit, fmtDb, GOLD, GREEN, MUTED, RED } from "../render/svg";
import { vm } from "../shared";
import { VmAction, type AnyAction } from "./base";

type GainDialSettings = { channel?: string; step?: string; press?: "mute" | "solo" | "none"; tap?: "solo" | "mute" | "zero" | "none"; meter?: boolean; color?: string } & JsonObject;

/** Complementary color (hue + 180°) with the lightness nudged so it reads as a warning next to the base. */
export function hotColor(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex.trim());
  if (!m) return "#ff7a1a";
  const n = parseInt(m[1], 16);
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const dd = max - min;
    s = l > 0.5 ? dd / (2 - max - min) : dd / (max + min);
    h = max === r ? ((g - b) / dd + (g < b ? 6 : 0)) / 6 : max === g ? ((b - r) / dd + 2) / 6 : ((r - g) / dd + 4) / 6;
  }
  h = (h + 0.5) % 1;
  s = Math.max(0.65, s);
  const L = Math.min(0.6, Math.max(0.5, l));
  const q = L < 0.5 ? L * (1 + s) : L + s - L * s, p = 2 * L - q;
  const f = (t: number) => { t = (t + 1) % 1; return t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p; };
  const to = (v: number) => Math.round(v * 255).toString(16).padStart(2, "0");
  return `#${to(f(h + 1 / 3))}${to(f(h))}${to(f(h - 1 / 3))}`;
}

@action({ UUID: "com.mjp.simplyvoicemeeter.dial-gain" })
export class GainDial extends VmAction<GainDialSettings> {
  protected override usesMeter = true;

  protected override async render(a: AnyAction<GainDialSettings>, s: GainDialSettings): Promise<void> {
    if (!a.isDial()) return;
    if (!vm.connected) {
      await a.setFeedback({ title: { value: vm.installed ? "VOICEMEETER" : "NOT INSTALLED", color: DIM }, value: { value: vm.installed ? "not running" : "", color: MUTED }, meter: 0, gain: 0 });
      return;
    }
    const c = vm.byId(s.channel);
    if (!c) {
      await a.setFeedback({ title: { value: "GAIN", color: DIM }, value: { value: "pick a strip or bus", color: MUTED }, meter: 0, gain: 0 });
      return;
    }
    const db = c.gain;
    const level = c.mute ? -60 : c.levelDb;
    const base = /^#[0-9a-f]{6}$/i.test(s.color ?? "") ? (s.color as string) : ACCENT;
    const hot = hotColor(base);
    const isHot = db > 0 && !c.mute;
    await a.setFeedback({
      title: { value: fit(c.label, 18), color: c.mute ? RED : MUTED },
      value: { value: c.mute ? `${fmtDb(db)}  ·  MUTED` : c.solo ? `${fmtDb(db)}  ·  SOLO` : fmtDb(db), color: c.mute ? RED : isHot ? hot : FG },
      gain: { value: Math.round((Math.min(0, Math.max(-60, db)) + 60) / 60 * 1000), bar_fill_c: c.mute ? DIM : base },
      hot: { value: Math.round(Math.max(0, Math.min(12, db)) / 12 * 1000), bar_fill_c: c.mute ? DIM : hot },
      meter: { value: s.meter === false ? 0 : Math.round(((level + 60) / 60) * 1000), bar_fill_c: level > -3 ? RED : level > -12 ? GOLD : GREEN },
    });
  }

  override async onDialRotate(ev: DialRotateEvent<GainDialSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    const c = vm.byId(s.channel);
    if (!vm.connected || !c) return ev.action.showAlert();
    const step = Number(s.step) || 1;
    // Write every tick: the call is non-blocking and the model holds the written value against the next poll.
    const db = Math.max(-60, Math.min(12, Math.round((c.gain + ev.payload.ticks * step) * 10) / 10));
    await this.run(ev.action, () => vm.setGain(c, db));
    await this.render(ev.action, s);
  }

  override async onDialDown(ev: DialDownEvent<GainDialSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    const c = vm.byId(s.channel);
    if (!c) return ev.action.showAlert();
    await this.act(ev.action, c, s.press ?? "solo");
  }

  override async onTouchTap(ev: TouchTapEvent<GainDialSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    const c = vm.byId(s.channel);
    if (!c) return ev.action.showAlert();
    await this.act(ev.action, c, s.tap ?? "mute");
  }

  private async act(a: AnyAction<GainDialSettings>, c: NonNullable<ReturnType<typeof vm.byId>>, what: string): Promise<void> {
    switch (what) {
      case "mute":
        return this.run(a, () => vm.setMute(c, !c.mute));
      case "solo":
        return this.run(a, () => vm.set(`${vm.param(c)}.${c.kind === "bus" ? "Sel" : "Solo"}`, c.solo ? 0 : 1));
      case "zero":
        return this.run(a, () => vm.setGain(c, 0));
      default:
        return;
    }
  }
}
