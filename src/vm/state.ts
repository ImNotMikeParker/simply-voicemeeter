/**
 * Live model of Voicemeeter: which edition, every strip and bus with its label, gain, mute, solo, mono, routing
 * and output device, macro button states, and level meters. Polls the DLL's dirty flag every 100 ms (cheap) and
 * re-reads only when something changed; levels run at 20 fps only while a meter is on screen.
 */
import { EventEmitter } from "node:events";
import { deviceTypeParam, LevelType, VmType, VoicemeeterApi, type AudioDevice, type DeviceType } from "./api";

export type Channel = {
  /** "strip" | "bus" */
  kind: "strip" | "bus";
  index: number;
  /** Voicemeeter's default name: "Hardware Input 1", "A1", … */
  defaultName: string;
  /** User label from Voicemeeter, or defaultName when empty. */
  label: string;
  physical: boolean;
  gain: number;
  mute: boolean;
  solo: boolean;
  mono: boolean;
  /** Strips only: A1..A5, B1..B3 assignment flags, in that order up to the edition's bus count. */
  routes: boolean[];
  /** Physical buses/strips: current audio device name. */
  deviceName: string;
  /** Level meter channel range [first, count] for GetLevel. */
  meter: [number, number];
  /** Latest peak level in dB (-60 floor), updated by the level loop when subscribed. */
  levelDb: number;
  /** Until this time, a locally written gain beats whatever the poll reads back (Voicemeeter applies writes a tick late). */
  gainHoldUntil?: number;
};

export type Layout = {
  type: VmType;
  name: string;
  strips: { physical: number; virtual: number };
  buses: string[]; // bus names in index order
  stripMeter: (i: number) => [number, number];
  busMeter: (i: number) => [number, number];
};

const LAYOUTS: Record<VmType, Layout> = {
  [VmType.Standard]: {
    type: VmType.Standard,
    name: "Voicemeeter",
    strips: { physical: 2, virtual: 1 },
    buses: ["A", "B"],
    stripMeter: (i) => (i < 2 ? [i * 2, 2] : [4, 8]),
    busMeter: (i) => [i * 8, 8],
  },
  [VmType.Banana]: {
    type: VmType.Banana,
    name: "Voicemeeter Banana",
    strips: { physical: 3, virtual: 2 },
    buses: ["A1", "A2", "A3", "B1", "B2"],
    stripMeter: (i) => (i < 3 ? [i * 2, 2] : [6 + (i - 3) * 8, 8]),
    busMeter: (i) => [i * 8, 8],
  },
  [VmType.Potato]: {
    type: VmType.Potato,
    name: "Voicemeeter Potato",
    strips: { physical: 5, virtual: 3 },
    buses: ["A1", "A2", "A3", "A4", "A5", "B1", "B2", "B3"],
    stripMeter: (i) => (i < 5 ? [i * 2, 2] : [10 + (i - 5) * 8, 8]),
    busMeter: (i) => [i * 8, 8],
  },
};

const VIRTUAL_NAMES = ["Virtual Input", "Voicemeeter AUX", "VAIO 3"];
export const toDb = (linear: number): number => (linear <= 0 ? -60 : Math.max(-60, 20 * Math.log10(linear)));

type Log = { info(m: string): void; warn(m: string): void };

export class Voicemeeter extends EventEmitter {
  api: VoicemeeterApi | null = null;
  installed = false;
  connected = false;
  layout: Layout | null = null;
  version = "";
  strips: Channel[] = [];
  buses: Channel[] = [];
  macros = new Map<number, boolean>();
  outputDevices: AudioDevice[] = [];
  error = "";

  private pollTimer: NodeJS.Timeout | null = null;
  private levelTimer: NodeJS.Timeout | null = null;
  private meterSubscribers = 0;
  private pending: NodeJS.Timeout | null = null;
  private lastDevices = 0;

  constructor(private log: Log) {
    super();
  }

  private changed(): void {
    if (this.pending) return;
    this.pending = setTimeout(() => {
      this.pending = null;
      this.emit("update");
    }, 30);
  }

  start(): void {
    try {
      this.api = new VoicemeeterApi();
      this.installed = true;
      const r = this.api.login();
      this.log.info(`logged in to Voicemeeter Remote (${r === 0 ? "running" : "not running yet"}) from ${this.api.folder}`);
    } catch (e) {
      this.error = e instanceof Error ? e.message : String(e);
      this.log.warn(this.error);
      this.changed();
      return;
    }
    this.poll();
    this.pollTimer = setInterval(() => this.poll(), 100);
  }

  stop(): void {
    if (this.pollTimer) clearInterval(this.pollTimer);
    if (this.levelTimer) clearInterval(this.levelTimer);
    this.pollTimer = this.levelTimer = null;
    this.api?.logout();
  }

  /** Call from actions that draw meters; stop when they disappear. */
  subscribeLevels(): () => void {
    this.meterSubscribers++;
    if (!this.levelTimer) this.levelTimer = setInterval(() => this.readLevels(), 50);
    let done = false;
    return () => {
      if (done) return;
      done = true;
      this.meterSubscribers--;
      if (this.meterSubscribers <= 0 && this.levelTimer) {
        clearInterval(this.levelTimer);
        this.levelTimer = null;
      }
    };
  }

  // ---------------------------------------------------------------------------
  // Polling
  // ---------------------------------------------------------------------------

  private poll(): void {
    const api = this.api!;
    const dirty = api.isDirty();
    if (dirty < 0) {
      if (this.connected) {
        this.connected = false;
        this.layout = null;
        this.log.info("Voicemeeter is not running");
        this.changed();
      }
      return;
    }
    if (!this.connected) {
      const type = api.type();
      if (!type || !LAYOUTS[type]) return;
      this.connected = true;
      this.layout = LAYOUTS[type];
      this.version = api.version() ?? "";
      this.log.info(`connected to ${this.layout.name} ${this.version}`);
      this.buildChannels();
      this.refreshAll();
      this.refreshDevices();
      this.changed();
      return;
    }
    if (dirty > 0) {
      this.refreshAll();
      this.changed();
    }
    if (api.macroIsDirty() > 0) {
      this.refreshMacros();
      this.changed();
    }
    if (Date.now() - this.lastDevices > 30_000) this.refreshDevices();
  }

  private buildChannels(): void {
    const l = this.layout!;
    this.strips = [];
    for (let i = 0; i < l.strips.physical + l.strips.virtual; i++) {
      const physical = i < l.strips.physical;
      this.strips.push({
        kind: "strip",
        index: i,
        defaultName: physical ? `Hardware Input ${i + 1}` : VIRTUAL_NAMES[i - l.strips.physical] ?? `Virtual ${i + 1}`,
        label: "",
        physical,
        gain: 0,
        mute: false,
        solo: false,
        mono: false,
        routes: l.buses.map(() => false),
        deviceName: "",
        meter: l.stripMeter(i),
        levelDb: -60,
      });
    }
    this.buses = l.buses.map((name, i) => ({
      kind: "bus",
      index: i,
      defaultName: name,
      label: "",
      physical: name.startsWith("A"),
      gain: 0,
      mute: false,
      solo: false,
      mono: false,
      routes: [],
      deviceName: "",
      meter: l.busMeter(i),
      levelDb: -60,
    }));
  }

  private refreshAll(): void {
    const api = this.api!;
    const l = this.layout!;
    const f = (n: string) => api.getFloat(n) ?? 0;
    for (const s of this.strips) {
      const p = `Strip[${s.index}]`;
      s.label = api.getString(`${p}.Label`) || s.defaultName;
      if (!(s.gainHoldUntil && Date.now() < s.gainHoldUntil)) s.gain = f(`${p}.Gain`);
      s.mute = f(`${p}.Mute`) >= 0.5;
      s.solo = f(`${p}.Solo`) >= 0.5;
      s.mono = f(`${p}.Mono`) >= 0.5;
      s.routes = l.buses.map((b) => f(`${p}.${b}`) >= 0.5);
      if (s.physical) s.deviceName = api.getString(`${p}.device.name`) ?? "";
    }
    for (const b of this.buses) {
      const p = `Bus[${b.index}]`;
      b.label = api.getString(`${p}.Label`) || b.defaultName;
      if (!(b.gainHoldUntil && Date.now() < b.gainHoldUntil)) b.gain = f(`${p}.Gain`);
      b.mute = f(`${p}.Mute`) >= 0.5;
      b.mono = f(`${p}.Mono`) >= 0.5;
      b.solo = f(`${p}.Sel`) >= 0.5;
      if (b.physical) b.deviceName = api.getString(`${p}.device.name`) ?? "";
    }
    this.refreshMacros();
  }

  private refreshMacros(): void {
    const api = this.api!;
    for (let i = 0; i < 80; i++) {
      const v = api.macroGet(i, 2);
      if (v === null) break;
      this.macros.set(i, v >= 0.5);
    }
  }

  private refreshDevices(): void {
    this.lastDevices = Date.now();
    try {
      this.outputDevices = this.api!.outputDevices();
    } catch (e) {
      this.log.warn(`device enumeration failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  private readLevels(): void {
    if (!this.connected || !this.api) return;
    const api = this.api;
    let any = false;
    const read = (c: Channel, type: LevelType) => {
      let peak = 0;
      for (let k = 0; k < c.meter[1]; k++) peak = Math.max(peak, api.level(type, c.meter[0] + k));
      const db = toDb(peak);
      if (Math.abs(db - c.levelDb) > 0.5) {
        c.levelDb = db;
        any = true;
      }
    };
    for (const s of this.strips) read(s, LevelType.PostMuteInput);
    for (const b of this.buses) read(b, LevelType.Output);
    if (any) this.emit("levels");
  }

  // ---------------------------------------------------------------------------
  // Lookups
  // ---------------------------------------------------------------------------

  channel(kind: "strip" | "bus", index: number): Channel | null {
    return (kind === "strip" ? this.strips : this.buses)[index] ?? null;
  }
  /** "strip:0" / "bus:3" ids used in settings. */
  byId(id: string | undefined): Channel | null {
    if (!id) return null;
    const [kind, idx] = id.split(":");
    if (kind !== "strip" && kind !== "bus") return null;
    return this.channel(kind, Number(idx));
  }
  param(c: Channel): string {
    return `${c.kind === "strip" ? "Strip" : "Bus"}[${c.index}]`;
  }

  // ---------------------------------------------------------------------------
  // Commands (all write-through: Voicemeeter's dirty flag brings the real state back within 100 ms)
  // ---------------------------------------------------------------------------

  private need(): VoicemeeterApi {
    if (!this.api || !this.connected) throw new Error("Voicemeeter is not running");
    return this.api;
  }
  set(name: string, value: number): void {
    const r = this.need().setFloat(name, value);
    if (r < 0) throw new Error(`set ${name} failed (${r})`);
  }
  setString(name: string, value: string): void {
    const r = this.need().setString(name, value);
    if (r < 0) throw new Error(`set ${name} failed (${r})`);
  }
  script(text: string): void {
    const r = this.need().script(text);
    if (r !== 0) throw new Error(r > 0 ? `script error on line ${r}` : `script failed (${r})`);
  }
  setMute(c: Channel, on: boolean): void {
    this.set(`${this.param(c)}.Mute`, on ? 1 : 0);
    c.mute = on;
    this.changed();
  }
  setGain(c: Channel, db: number): void {
    const v = Math.max(-60, Math.min(12, db));
    this.set(`${this.param(c)}.Gain`, v);
    c.gain = v;
    c.gainHoldUntil = Date.now() + 400;
    this.changed();
  }
  fadeTo(c: Channel, db: number, ms: number): void {
    this.setString(`${this.param(c)}.FadeTo`, `(${db.toFixed(1)}, ${Math.round(ms)})`);
  }
  setRoute(strip: Channel, bus: string, on: boolean): void {
    this.set(`${this.param(strip)}.${bus}`, on ? 1 : 0);
    const i = this.layout!.buses.indexOf(bus);
    if (i >= 0) strip.routes[i] = on;
    this.changed();
  }
  setDevice(bus: Channel, device: AudioDevice | null): void {
    // An empty name unselects. Selecting needs the right type-specific parameter.
    const type: DeviceType = device?.type ?? (3 as DeviceType);
    this.setString(`${this.param(bus)}.device.${deviceTypeParam(type)}`, device?.name ?? "");
  }
  setMacro(id: number, on: boolean, bitmode = 2): void {
    const r = this.need().macroSet(id, on ? 1 : 0, bitmode);
    if (r < 0) throw new Error(`macro ${id} failed (${r})`);
    this.macros.set(id, on);
    this.changed();
  }
  recallPreset(index: number): void {
    this.set(`Command.Preset[${index}].Recall`, 1);
  }
  loadConfig(path: string): void {
    this.setString("Command.Load", path);
  }
  restartEngine(): void {
    this.set("Command.Restart", 1);
  }
}
