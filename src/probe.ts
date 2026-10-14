/** Standalone check: connect to Voicemeeter, dump the model, watch levels for a few seconds. No Stream Deck needed. */
import { deviceTypeName } from "./vm/api";
import { Voicemeeter } from "./vm/state";

const log = { info: (m: string) => console.log(`[info] ${m}`), warn: (m: string) => console.log(`[warn] ${m}`) };
const vm = new Voicemeeter(log);
vm.start();

const dump = () => {
  if (!vm.connected) return console.log(vm.installed ? "Voicemeeter not running" : `not installed: ${vm.error}`);
  console.log(`${vm.layout!.name} ${vm.version}`);
  for (const s of vm.strips) console.log(`  strip ${s.index} ${JSON.stringify(s.label)} gain ${s.gain.toFixed(1)} mute ${s.mute} solo ${s.solo} routes [${vm.layout!.buses.filter((_, i) => s.routes[i]).join(",")}] ${s.physical ? `dev ${JSON.stringify(s.deviceName)}` : ""}`);
  for (const b of vm.buses) console.log(`  bus   ${b.index} ${b.defaultName} ${JSON.stringify(b.label)} gain ${b.gain.toFixed(1)} mute ${b.mute} ${b.physical ? `dev ${JSON.stringify(b.deviceName)}` : ""}`);
  console.log(`  macros on: [${[...vm.macros].filter(([, v]) => v).map(([k]) => k).join(",")}]`);
  console.log(`  output devices: ${vm.outputDevices.map((d) => `${deviceTypeName(d.type)}:${d.name}`).join(" | ")}`);
};
setTimeout(dump, 500);
vm.on("update", () => console.log("[update]"));
const unsub = vm.subscribeLevels();
vm.on("levels", () => console.log("levels", vm.strips.map((s) => `${s.label.slice(0, 8)}:${s.levelDb.toFixed(0)}`).join(" "), "|", vm.buses.map((b) => `${b.defaultName}:${b.levelDb.toFixed(0)}`).join(" ")));
setTimeout(() => {
  unsub();
  vm.stop();
  console.log("done");
  process.exit(0);
}, 6000);
