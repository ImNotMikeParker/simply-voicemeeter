import { action, type KeyDownEvent, type KeyUpEvent } from "@elgato/streamdeck";
import type { JsonObject } from "@elgato/utils";
import { deviceKey, gainKey, macroKey, muteKey, offlineKey, presetKey, routeKey, scriptKey, statusKey } from "../render/svg";
import { sameDevice, vm } from "../shared";
import { deviceTypeParam, type DeviceType } from "../vm/api";
import { VmAction, type AnyAction } from "./base";

const HOLD_MS = 500;

/** Meter-drawing variant: subscribes to levels while visible. */
abstract class VmActionWithMeter<T extends JsonObject> extends VmAction<T> {
  protected override usesMeter = true;
}
const off = () => offlineKey(vm.installed, vm.connected, vm.error);

// ---------------------------------------------------------------------------
// Mute: toggle / push-to-talk / set, with a live meter
// ---------------------------------------------------------------------------

type MuteSettings = { channel?: string; mode?: "toggle" | "ptt" | "mute" | "unmute"; meter?: boolean };

@action({ UUID: "com.mjp.simplyvoicemeeter.mute" })
export class MuteKey extends VmActionWithMeter<MuteSettings> {
  protected override async render(a: AnyAction<MuteSettings>, s: MuteSettings): Promise<void> {
    if (a.isDial()) return;
    await a.setImage(off() ?? muteKey(vm.byId(s.channel), s.meter !== false, s.mode === "ptt"));
  }
  override async onKeyDown(ev: KeyDownEvent<MuteSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    const c = vm.byId(s.channel);
    if (!c) return ev.action.showAlert();
    await this.run(ev.action, () => {
      switch (s.mode) {
        case "ptt":
          return vm.setMute(c, false);
        case "mute":
          return vm.setMute(c, true);
        case "unmute":
          return vm.setMute(c, false);
        default:
          return vm.setMute(c, !c.mute);
      }
    });
  }
  override async onKeyUp(ev: KeyUpEvent<MuteSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    if (s.mode !== "ptt") return;
    const c = vm.byId(s.channel);
    if (c) await this.run(ev.action, () => vm.setMute(c, true));
  }
}

// ---------------------------------------------------------------------------
// Gain: press = value A, hold = value B (or fade), with a live meter
// ---------------------------------------------------------------------------

type GainSettings = { channel?: string; a?: string; b?: string; fadeMs?: string; meter?: boolean };

@action({ UUID: "com.mjp.simplyvoicemeeter.gain" })
export class GainKey extends VmActionWithMeter<GainSettings> {
  private holds = new Map<string, NodeJS.Timeout>();
  protected override async render(a: AnyAction<GainSettings>, s: GainSettings): Promise<void> {
    if (a.isDial()) return;
    await a.setImage(off() ?? gainKey(vm.byId(s.channel), s.meter !== false, num(s.a, 0), num(s.b, -60)));
  }
  private apply(c: Parameters<typeof vm.setGain>[0], db: number, fadeMs: number): void {
    if (fadeMs > 0) vm.fadeTo(c, db, fadeMs);
    else vm.setGain(c, db);
  }
  override async onKeyDown(ev: KeyDownEvent<GainSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    const c = vm.byId(s.channel);
    if (!c) return ev.action.showAlert();
    const id = ev.action.id;
    this.holds.set(
      id,
      setTimeout(() => {
        this.holds.delete(id);
        void this.run(ev.action, () => this.apply(c, num(s.b, -60), num(s.fadeMs, 0)));
      }, HOLD_MS),
    );
  }
  override async onKeyUp(ev: KeyUpEvent<GainSettings>): Promise<void> {
    const t = this.holds.get(ev.action.id);
    if (!t) return; // the hold already fired
    clearTimeout(t);
    this.holds.delete(ev.action.id);
    const s = ev.payload.settings ?? {};
    const c = vm.byId(s.channel);
    if (c) await this.run(ev.action, () => this.apply(c, num(s.a, 0), num(s.fadeMs, 0)));
  }
}

// ---------------------------------------------------------------------------
// Output device: set a bus's device, or swap between two. Live "which one is active" state.
// ---------------------------------------------------------------------------

type DeviceSettings = { bus?: string; device?: string; device2?: string; label?: string; label2?: string; image?: string; image2?: string };

/** "wdm|Speakers (PRO X 2 LIGHTSPEED)" → { type, name } */
function parseDevice(v: string | undefined): { type: DeviceType; name: string } | null {
  if (!v) return null;
  const i = v.indexOf("|");
  if (i < 0) return { type: 3 as DeviceType, name: v };
  const t = { mme: 1, wdm: 3, ks: 4, asio: 5 }[v.slice(0, i)] ?? 3;
  return { type: t as DeviceType, name: v.slice(i + 1) };
}

@action({ UUID: "com.mjp.simplyvoicemeeter.device" })
export class DeviceKey extends VmAction<DeviceSettings> {
  protected override async render(a: AnyAction<DeviceSettings>, s: DeviceSettings): Promise<void> {
    if (a.isDial()) return;
    const o = off();
    if (o) return a.setImage(o);
    const bus = vm.byId(s.bus);
    const d1 = parseDevice(s.device);
    const d2 = parseDevice(s.device2);
    if (!bus || !d1) return a.setImage(deviceKey(bus, d1?.name ?? "Output", null, d1 ? "" : "pick a device"));
    const on1 = sameDevice(bus.deviceName, d1.name);
    if (d2) {
      // Swap key: show whichever is live.
      const on2 = sameDevice(bus.deviceName, d2.name);
      const cur = on1 ? 1 : on2 ? 2 : 0;
      const label = cur === 2 ? s.label2 || d2.name : s.label || d1.name;
      await a.setImage(deviceKey(bus, label, cur !== 0, cur === 0 ? `${bus.label}: other device` : `${bus.label} · tap to swap`, cur === 2 ? s.image2 : s.image));
      return;
    }
    await a.setImage(deviceKey(bus, s.label || d1.name, on1, on1 ? `${bus.label} active` : `${bus.label} · tap to select`, s.image));
  }
  override async onKeyDown(ev: KeyDownEvent<DeviceSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    const bus = vm.byId(s.bus);
    const d1 = parseDevice(s.device);
    const d2 = parseDevice(s.device2);
    if (!bus || !d1) return ev.action.showAlert();
    await this.run(ev.action, () => {
      const target = d2 && sameDevice(bus.deviceName, d1.name) ? d2 : d1;
      vm.setString(`${vm.param(bus)}.device.${deviceTypeParam(target.type)}`, target.name);
    });
  }
}

// ---------------------------------------------------------------------------
// Route: strip → bus assignment toggle
// ---------------------------------------------------------------------------

type RouteSettings = { strip?: string; bus?: string };

@action({ UUID: "com.mjp.simplyvoicemeeter.route" })
export class RouteKey extends VmAction<RouteSettings> {
  protected override async render(a: AnyAction<RouteSettings>, s: RouteSettings): Promise<void> {
    if (a.isDial()) return;
    const o = off();
    if (o) return a.setImage(o);
    const strip = vm.byId(s.strip);
    const bus = s.bus || vm.layout?.buses[0] || "A1";
    const i = vm.layout?.buses.indexOf(bus) ?? -1;
    await a.setImage(routeKey(strip, bus, !!strip && i >= 0 && strip.routes[i]));
  }
  override async onKeyDown(ev: KeyDownEvent<RouteSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    const strip = vm.byId(s.strip);
    const bus = s.bus || vm.layout?.buses[0] || "A1";
    const i = vm.layout?.buses.indexOf(bus) ?? -1;
    if (!strip || i < 0) return ev.action.showAlert();
    await this.run(ev.action, () => vm.setRoute(strip, bus, !strip.routes[i]));
  }
}

// ---------------------------------------------------------------------------
// Macro button: toggle or push
// ---------------------------------------------------------------------------

type MacroSettings = { id?: string; mode?: "toggle" | "push"; label?: string };

@action({ UUID: "com.mjp.simplyvoicemeeter.macro" })
export class MacroKey extends VmAction<MacroSettings> {
  protected override async render(a: AnyAction<MacroSettings>, s: MacroSettings): Promise<void> {
    if (a.isDial()) return;
    const o = off();
    if (o) return a.setImage(o);
    const id = num(s.id, 0);
    await a.setImage(macroKey(id, vm.macros.has(id) ? vm.macros.get(id)! : null, s.label ?? ""));
  }
  override async onKeyDown(ev: KeyDownEvent<MacroSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    const id = num(s.id, 0);
    await this.run(ev.action, () => vm.setMacro(id, s.mode === "push" ? true : !vm.macros.get(id), s.mode === "push" ? 0 : 2));
  }
  override async onKeyUp(ev: KeyUpEvent<MacroSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    if (s.mode !== "push") return;
    await this.run(ev.action, () => vm.setMacro(num(s.id, 0), false, 0));
  }
}

// ---------------------------------------------------------------------------
// Script: Voicemeeter's own command syntax. Press / hold / toggle / push-to-talk, optional live state.
// ---------------------------------------------------------------------------

type ScriptSettings = {
  mode?: "press" | "toggle" | "ptt";
  script?: string; // press, or toggle "on", or ptt "down"
  script2?: string; // hold, or toggle "off", or ptt "up"
  state?: string; // parameter to read for on/off, e.g. Strip[0].Mute
  stateValue?: string; // value meaning "on" (default 1); for strings, compared case-insensitively on 31 chars
  label?: string;
  image?: string;
  image2?: string;
};

@action({ UUID: "com.mjp.simplyvoicemeeter.script" })
export class ScriptKey extends VmAction<ScriptSettings> {
  private holds = new Map<string, NodeJS.Timeout>();

  private isOn(s: ScriptSettings): boolean | null {
    const p = s.state?.trim();
    if (!p || !vm.api || !vm.connected) return null;
    const want = (s.stateValue ?? "1").trim();
    if (/^-?\d+(\.\d+)?$/.test(want)) {
      const v = vm.api.getFloat(p);
      return v === null ? null : Math.abs(v - Number(want)) < 0.01;
    }
    const str = vm.api.getString(p);
    return str === null ? null : sameDevice(str, want.replace(/^"|"$/g, ""));
  }

  protected override async render(a: AnyAction<ScriptSettings>, s: ScriptSettings): Promise<void> {
    if (a.isDial()) return;
    const o = off();
    if (o) return a.setImage(o);
    const on = this.isOn(s);
    await a.setImage(scriptKey(s.label ?? "", on, on === false ? s.image2 || s.image : s.image));
  }

  override async onKeyDown(ev: KeyDownEvent<ScriptSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    const mode = s.mode ?? "press";
    if (mode === "ptt") return this.run(ev.action, () => vm.script(s.script ?? ""));
    if (mode === "toggle") {
      const on = this.isOn(s);
      return this.run(ev.action, () => vm.script((on ? s.script2 : s.script) ?? ""));
    }
    // press: fire script on release unless held long enough for script2
    if (!s.script2?.trim()) return this.run(ev.action, () => vm.script(s.script ?? ""));
    const id = ev.action.id;
    this.holds.set(
      id,
      setTimeout(() => {
        this.holds.delete(id);
        void this.run(ev.action, () => vm.script(s.script2 ?? ""));
      }, HOLD_MS),
    );
  }

  override async onKeyUp(ev: KeyUpEvent<ScriptSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    if ((s.mode ?? "press") === "ptt") return this.run(ev.action, () => vm.script(s.script2 ?? ""));
    const t = this.holds.get(ev.action.id);
    if (!t) return;
    clearTimeout(t);
    this.holds.delete(ev.action.id);
    await this.run(ev.action, () => vm.script(s.script ?? ""));
  }
}

// ---------------------------------------------------------------------------
// Preset recall / config load, and a status key
// ---------------------------------------------------------------------------

type PresetSettings = { preset?: string; file?: string; label?: string };

@action({ UUID: "com.mjp.simplyvoicemeeter.preset" })
export class PresetKey extends VmAction<PresetSettings> {
  protected override async render(a: AnyAction<PresetSettings>, s: PresetSettings): Promise<void> {
    if (a.isDial()) return;
    await a.setImage(off() ?? presetKey(s.label || (s.file ? s.file.split(/[\\/]/).pop() ?? "Config" : `Preset ${num(s.preset, 1)}`)));
  }
  override async onKeyDown(ev: KeyDownEvent<PresetSettings>): Promise<void> {
    const s = ev.payload.settings ?? {};
    await this.run(ev.action, () => (s.file?.trim() ? vm.loadConfig(s.file.trim()) : vm.recallPreset(num(s.preset, 1) - 1)));
    await ev.action.showOk();
  }
}

@action({ UUID: "com.mjp.simplyvoicemeeter.status" })
export class StatusKey extends VmAction {
  protected override async render(a: AnyAction<never>): Promise<void> {
    if (a.isDial()) return;
    await a.setImage(statusKey(vm.installed, vm.connected, vm.layout?.name ?? "", vm.version, vm.error));
  }
  /** Press: bring the Voicemeeter window up (or restart the audio engine on hold). */
  private holds = new Map<string, NodeJS.Timeout>();
  override async onKeyDown(ev: KeyDownEvent): Promise<void> {
    const id = ev.action.id;
    this.holds.set(
      id,
      setTimeout(() => {
        this.holds.delete(id);
        void this.run(ev.action, () => vm.restartEngine());
      }, 1200),
    );
  }
  override async onKeyUp(ev: KeyUpEvent): Promise<void> {
    const t = this.holds.get(ev.action.id);
    if (!t) return;
    clearTimeout(t);
    this.holds.delete(ev.action.id);
    await this.run(ev.action, () => vm.set("Command.Show", 1));
  }
}

// ---------------------------------------------------------------------------

function num(v: string | number | undefined, d: number): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) && v !== "" && v !== undefined ? n : d;
}
