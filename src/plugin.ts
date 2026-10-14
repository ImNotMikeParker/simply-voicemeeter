import streamDeck from "@elgato/streamdeck";
import type { JsonValue } from "@elgato/utils";
import { GainDial } from "./actions/dials";
import { DeviceKey, GainKey, MacroKey, MuteKey, PresetKey, RouteKey, ScriptKey, StatusKey } from "./actions/keys";
import { vm } from "./shared";
import { deviceTypeName, deviceTypeParam } from "./vm/api";

streamDeck.logger.setLevel("info");
const logger = streamDeck.logger.createScope("plugin");

for (const a of [new MuteKey(), new GainKey(), new DeviceKey(), new RouteKey(), new MacroKey(), new ScriptKey(), new PresetKey(), new StatusKey(), new GainDial()]) {
  streamDeck.actions.registerAction(a);
}

// ---------------------------------------------------------------------------
// Property inspector: status line plus dropdown data sources that use Voicemeeter's own labels
// ---------------------------------------------------------------------------

type Item = { label: string; value: string; disabled?: boolean };
const send = (payload: JsonValue) => streamDeck.ui.sendToPropertyInspector(payload).catch((e) => logger.warn(`sendToPropertyInspector failed: ${e}`));

function sendStatus(): void {
  if (!streamDeck.ui.action) return;
  send({ event: "status", installed: vm.installed, connected: vm.connected, name: vm.layout?.name ?? "", version: vm.version, error: vm.error });
}

function channels(kind: "strip" | "bus" | "both"): Item[] {
  if (!vm.connected) return [{ label: "Voicemeeter is not running", value: "", disabled: true }];
  const out: Item[] = [];
  if (kind !== "bus") for (const s of vm.strips) out.push({ label: `${s.label}${s.label !== s.defaultName ? ` (${s.defaultName})` : ""}`, value: `strip:${s.index}` });
  if (kind !== "strip") for (const b of vm.buses) out.push({ label: `${b.defaultName}${b.label !== b.defaultName ? ` · ${b.label}` : ""}${b.deviceName ? ` → ${b.deviceName}` : ""}`, value: `bus:${b.index}` });
  return out;
}

streamDeck.ui.onDidAppear(() => sendStatus());
streamDeck.ui.onSendToPlugin<JsonValue>((ev) => {
  const msg = ev.payload as { event?: string } | null;
  switch (msg?.event) {
    case "get-status":
      return sendStatus();
    case "getChannels":
      return void send({ event: "getChannels", items: channels("both") });
    case "getStrips":
      return void send({ event: "getStrips", items: channels("strip") });
    case "getBuses":
      return void send({ event: "getBuses", items: channels("bus") });
    case "getBusNames":
      return void send({ event: "getBusNames", items: (vm.layout?.buses ?? ["A1", "A2", "A3", "B1", "B2"]).map((b) => ({ label: b, value: b })) });
    case "getDevices": {
      const items: Item[] = vm.outputDevices
        .filter((d) => d.type !== 5) // ASIO only applies to A1 and needs its own dialog; keep the list sane
        .map((d) => ({ label: `${d.name}  [${deviceTypeName(d.type)}]`, value: `${deviceTypeParam(d.type)}|${d.name}` }));
      return void send({ event: "getDevices", items: items.length ? items : [{ label: vm.connected ? "No output devices found" : "Voicemeeter is not running", value: "", disabled: true }] });
    }
    case "getDevices2":
      return void send({ event: "getDevices2", items: [{ label: "None (single device key)", value: "" }, ...vm.outputDevices.filter((d) => d.type !== 5).map((d) => ({ label: `${d.name}  [${deviceTypeName(d.type)}]`, value: `${deviceTypeParam(d.type)}|${d.name}` }))] });
    case "getMacros": {
      const items: Item[] = [...vm.macros.keys()].map((id) => ({ label: `Macro button ${id}`, value: String(id) }));
      return void send({ event: "getMacros", items: items.length ? items : Array.from({ length: 20 }, (_, i) => ({ label: `Macro button ${i}`, value: String(i) })) });
    }
  }
});
vm.on("update", sendStatus);

// ---------------------------------------------------------------------------

await streamDeck.connect();
vm.start();
logger.info(`Simply Voicemeeter ready (installed=${vm.installed})`);
