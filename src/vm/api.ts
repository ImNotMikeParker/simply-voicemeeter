/**
 * Thin binding to VoicemeeterRemote64.dll via koffi. Every call here is synchronous and non-blocking, per the API
 * doc ("all functions are thread safe and non-blocking"). Return codes: 0 = OK, >0 = info, <0 = error.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";
import koffi from "koffi";

export enum VmType {
  Standard = 1,
  Banana = 2,
  Potato = 3,
}

export enum LevelType {
  PreFaderInput = 0,
  PostFaderInput = 1,
  PostMuteInput = 2,
  Output = 3,
}

export enum DeviceType {
  MME = 1,
  WDM = 3,
  KS = 4,
  ASIO = 5,
}

export type AudioDevice = { type: DeviceType; name: string; hardwareId: string };

/** Where Voicemeeter is installed: the uninstall registry key the official sample uses, then the default folder. */
export function findVoicemeeterFolder(): string | null {
  try {
    const out = execFileSync(
      "reg",
      ["query", "HKLM\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\VB:Voicemeeter {17359A74-1236-5467}", "/v", "UninstallString"],
      { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], windowsHide: true },
    );
    const m = out.match(/UninstallString\s+REG_SZ\s+(.+)$/m);
    if (m) {
      const exe = m[1].trim().replace(/^"|"$/g, "");
      const dir = exe.slice(0, Math.max(exe.lastIndexOf("\\"), exe.lastIndexOf("/")));
      if (existsSync(join(dir, "VoicemeeterRemote64.dll"))) return dir;
    }
  } catch {
    /* not installed via the usual key */
  }
  const fallback = "C:\\Program Files (x86)\\VB\\Voicemeeter";
  return existsSync(join(fallback, "VoicemeeterRemote64.dll")) ? fallback : null;
}

type Fn = (...args: unknown[]) => number;

export class VoicemeeterApi {
  readonly folder: string;
  private f: Record<string, Fn>;
  private loggedIn = false;

  constructor(folder = findVoicemeeterFolder()) {
    if (!folder) throw new Error("Voicemeeter is not installed (VoicemeeterRemote64.dll not found)");
    this.folder = folder;
    // koffi wants forward slashes on Windows; a backslash path fails with "The parameter is incorrect".
    const lib = koffi.load(join(folder, "VoicemeeterRemote64.dll").replace(/\\/g, "/"));
    const d = (sig: string) => lib.func(sig) as unknown as Fn;
    this.f = {
      login: d("long __stdcall VBVMR_Login(void)"),
      logout: d("long __stdcall VBVMR_Logout(void)"),
      run: d("long __stdcall VBVMR_RunVoicemeeter(long type)"),
      type: d("long __stdcall VBVMR_GetVoicemeeterType(_Out_ long *p)"),
      version: d("long __stdcall VBVMR_GetVoicemeeterVersion(_Out_ long *p)"),
      dirty: d("long __stdcall VBVMR_IsParametersDirty(void)"),
      getFloat: d("long __stdcall VBVMR_GetParameterFloat(const char *name, _Out_ float *value)"),
      getString: d("long __stdcall VBVMR_GetParameterStringA(const char *name, _Out_ char *value)"),
      setFloat: d("long __stdcall VBVMR_SetParameterFloat(const char *name, float value)"),
      setString: d("long __stdcall VBVMR_SetParameterStringA(const char *name, const char *value)"),
      setParams: d("long __stdcall VBVMR_SetParameters(const char *script)"),
      level: d("long __stdcall VBVMR_GetLevel(long type, long channel, _Out_ float *value)"),
      mbDirty: d("long __stdcall VBVMR_MacroButton_IsDirty(void)"),
      mbGet: d("long __stdcall VBVMR_MacroButton_GetStatus(long id, _Out_ float *value, long bitmode)"),
      mbSet: d("long __stdcall VBVMR_MacroButton_SetStatus(long id, float value, long bitmode)"),
      inCount: d("long __stdcall VBVMR_Input_GetDeviceNumber(void)"),
      inDesc: d("long __stdcall VBVMR_Input_GetDeviceDescA(long index, _Out_ long *type, _Out_ char *name, _Out_ char *hwid)"),
      outCount: d("long __stdcall VBVMR_Output_GetDeviceNumber(void)"),
      outDesc: d("long __stdcall VBVMR_Output_GetDeviceDescA(long index, _Out_ long *type, _Out_ char *name, _Out_ char *hwid)"),
    };
  }

  /** Login once for the life of the process. 0 = OK and Voicemeeter running, 1 = OK but Voicemeeter not running. */
  login(): number {
    if (this.loggedIn) return 0;
    const r = this.f.login();
    if (r < 0) throw new Error(`VBVMR_Login failed (${r})`);
    this.loggedIn = true;
    return r;
  }
  logout(): void {
    if (!this.loggedIn) return;
    this.f.logout();
    this.loggedIn = false;
  }
  runVoicemeeter(type: VmType): number {
    return this.f.run(type);
  }
  type(): VmType | null {
    const p = [0];
    return this.f.type(p) === 0 ? (p[0] as VmType) : null;
  }
  version(): string | null {
    const p = [0];
    if (this.f.version(p) !== 0) return null;
    const v = p[0] >>> 0;
    return `${v >>> 24}.${(v >> 16) & 0xff}.${(v >> 8) & 0xff}.${v & 0xff}`;
  }
  /** 1 = parameters changed since last call, 0 = unchanged, <0 = Voicemeeter not running. */
  isDirty(): number {
    return this.f.dirty();
  }
  getFloat(name: string): number | null {
    const p = [0];
    return this.f.getFloat(name, p) === 0 ? p[0] : null;
  }
  getString(name: string): string | null {
    const buf = Buffer.alloc(512);
    if (this.f.getString(name, buf) !== 0) return null;
    const end = buf.indexOf(0);
    return buf.toString("utf8", 0, end < 0 ? buf.length : end);
  }
  setFloat(name: string, value: number): number {
    return this.f.setFloat(name, value);
  }
  setString(name: string, value: string): number {
    return this.f.setString(name, value);
  }
  /** Run a Voicemeeter script ("Strip[0].Mute=1; Bus[0].Gain=-6;"). Returns 0, or the 1-based line of the first error. */
  script(text: string): number {
    return this.f.setParams(text);
  }
  /** Linear level 0..1+ for one channel; see LevelType. */
  level(type: LevelType, channel: number): number {
    const p = [0];
    return this.f.level(type, channel, p) === 0 ? p[0] : 0;
  }
  macroIsDirty(): number {
    return this.f.mbDirty();
  }
  /** bitmode 0 = push state, 2 = displayed state, 3 = trigger enabled. */
  macroGet(id: number, bitmode = 2): number | null {
    const p = [0];
    return this.f.mbGet(id, p, bitmode) === 0 ? p[0] : null;
  }
  macroSet(id: number, value: number, bitmode = 2): number {
    return this.f.mbSet(id, value, bitmode);
  }
  outputDevices(): AudioDevice[] {
    return this.devices(this.f.outCount, this.f.outDesc);
  }
  inputDevices(): AudioDevice[] {
    return this.devices(this.f.inCount, this.f.inDesc);
  }
  private devices(count: Fn, desc: Fn): AudioDevice[] {
    const n = count();
    const list: AudioDevice[] = [];
    for (let i = 0; i < n; i++) {
      const t = [0];
      const name = Buffer.alloc(256);
      const hw = Buffer.alloc(256);
      if (desc(i, t, name, hw) !== 0) continue;
      const cut = (b: Buffer) => b.toString("utf8", 0, b.indexOf(0) < 0 ? b.length : b.indexOf(0));
      list.push({ type: t[0] as DeviceType, name: cut(name), hardwareId: cut(hw) });
    }
    return list;
  }
}

export const deviceTypeName = (t: DeviceType): string => ({ 1: "MME", 3: "WDM", 4: "KS", 5: "ASIO" })[t] ?? `type ${t}`;
/** Parameter suffix used to select a device of a given type: Bus[i].device.wdm = "name". */
export const deviceTypeParam = (t: DeviceType): string => ({ 1: "mme", 3: "wdm", 4: "ks", 5: "asio" })[t] ?? "wdm";
