/** Generates the property-inspector pages (ui/*.html) plus shared common.js / common.css. */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const uiDir = join(dirname(fileURLToPath(import.meta.url)), "..", "com.mjp.simplyvoicemeeter.sdPlugin", "ui");
mkdirSync(uiDir, { recursive: true });

const head = `<!DOCTYPE html>
<html>
<head lang="en">
  <meta charset="utf-8" />
  <title>Simply Voicemeeter</title>
  <script src="https://sdpi-components.dev/releases/v4/sdpi-components.js"></script>
  <link rel="stylesheet" href="common.css" />
  <script src="common.js"></script>
</head>
<body>
  <div id="status"></div>
  <hr />
`;
const foot = `</body>\n</html>\n`;

const opts = (list, def) => list.map((o) => { const [v, l] = o.split("|"); return `      <option value="${v}"${v === def ? " selected" : ""}>${l}</option>`; }).join("\n");
const select = (label, setting, list, def) => `  <sdpi-item label="${label}">\n    <sdpi-select setting="${setting}" default="${def}">\n${opts(list, def)}\n    </sdpi-select>\n  </sdpi-item>\n`;
const dyn = (label, setting, source, placeholder) => `  <sdpi-item label="${label}">\n    <sdpi-select setting="${setting}" datasource="${source}" loading="Reading Voicemeeter…" show-refresh placeholder="${placeholder}"></sdpi-select>\n  </sdpi-item>\n`;
const text = (label, setting, placeholder) => `  <sdpi-item label="${label}">\n    <sdpi-textfield setting="${setting}" placeholder="${placeholder}"></sdpi-textfield>\n  </sdpi-item>\n`;
const area = (label, setting, placeholder) => `  <sdpi-item label="${label}">\n    <sdpi-textarea setting="${setting}" placeholder="${placeholder}" rows="3"></sdpi-textarea>\n  </sdpi-item>\n`;
const file = (label, setting, accept) => `  <sdpi-item label="${label}">\n    <sdpi-file setting="${setting}" accept="${accept}"></sdpi-file>\n  </sdpi-item>\n`;
const check = (label, setting, txt, def) => `  <sdpi-item label="${label}">\n    <sdpi-checkbox setting="${setting}"${def ? ` default="true"` : ""} label="${txt}"></sdpi-checkbox>\n  </sdpi-item>\n`;
const help = (t) => `  <div class="sd-help">${t}</div>\n`;
const meter = check("Meter", "meter", "Show a live level meter", true);
const color = (def) => `  <sdpi-item label="Color">
    <sdpi-color setting="color" default="${def}"></sdpi-color>
  </sdpi-item>
`;

const pages = {
  "simple.html": help("Press to bring up the Voicemeeter window. Hold for about a second to restart the audio engine."),
  "mute.html":
    dyn("Strip / bus", "channel", "getChannels", "Choose what to mute") +
    select("Mode", "mode", ["toggle|Toggle", "ptt|Push-to-talk (unmuted while held)", "mute|Mute", "unmute|Unmute"], "toggle") +
    meter +
    help("Names come straight from Voicemeeter's labels. The key follows changes made in Voicemeeter itself."),
  "gain.html":
    dyn("Strip / bus", "channel", "getChannels", "Choose a strip or bus") +
    text("Press sets (dB)", "a", "0") +
    text("Hold sets (dB)", "b", "-60") +
    text("Fade (ms)", "fadeMs", "0 = instant") +
    meter +
    help("Range -60 to +12 dB. A fade time makes Voicemeeter glide to the value instead of jumping."),
  "device.html":
    dyn("Bus", "bus", "getBuses", "Choose an output bus (A1, A2, A3)") +
    dyn("Device", "device", "getDevices", "Choose the output device") +
    text("Label", "label", "Shown on the key, e.g. Headset") +
    file("Image", "image", ".png,.jpg,.jpeg,.svg") +
    `  <details><summary>Swap between two devices</summary>\n` +
    dyn("Second device", "device2", "getDevices2", "None") +
    text("Second label", "label2", "e.g. Speakers") +
    file("Second image", "image2", ".png,.jpg,.jpeg,.svg") +
    `  </details>\n` +
    help("With one device, the key selects it and lights up while it is active. With two, each press swaps and the key shows whichever is live. WDM is the right choice for almost everything."),
  "route.html": dyn("Strip", "strip", "getStrips", "Choose a strip") + dyn("Bus", "bus", "getBusNames", "Choose a bus") + help("Toggles the strip's A1 / A2 / B1 … button in Voicemeeter."),
  "macro.html":
    dyn("Macro button", "id", "getMacros", "Choose a button") +
    select("Mode", "mode", ["toggle|Toggle", "push|Push (held)"], "toggle") +
    text("Label", "label", "Shown on the key") +
    help("The logical ID is printed at the top centre of each button in the Voicemeeter Macro Buttons app, which must be running."),
  "script.html":
    select("Mode", "mode", ["press|Press (and hold for the second script)", "toggle|Toggle between the two scripts", "ptt|Push-to-talk (first on press, second on release)"], "press") +
    area("Script", "script", "Strip[0].Mute=1; Bus[0].Gain=-6;") +
    area("Second script", "script2", "Optional") +
    text("State parameter", "state", "Optional, e.g. Strip[0].Mute or Bus[0].device.name") +
    text("On when equal to", "stateValue", "1, or a text such as Speakers (PRO X 2 LIGHTSPEED)") +
    file("On image", "image", ".png,.jpg,.jpeg,.svg") +
    file("Off image", "image2", ".png,.jpg,.jpeg,.svg") +
    help("Same syntax as Voicemeeter's Macro Buttons and the Remote API: Strip[i].Gain=-6; Bus[i].Mute=1; Strip[i].Gain += 3; Command.Restart=1; Bus[0].device.wdm=\"Speakers (PRO X 2 LIGHTSPEED)\". Toggle mode reads the state parameter to decide which script runs next."),
  "preset.html":
    text("Preset number", "preset", "1") +
    text("Or load config file", "file", "C:\\\\path\\\\to\\\\config.xml") +
    text("Label", "label", "Shown on the key") +
    help("Preset scenes are the numbered slots in Voicemeeter's menu. A config file path takes precedence when set."),
  "dial-gain.html":
    dyn("Strip / bus", "channel", "getChannels", "Choose a strip or bus") +
    select("Step per click", "step", ["0.5|0.5 dB", "1|1 dB", "2|2 dB", "3|3 dB"], "1") +
    select("Press", "press", ["solo|Solo", "mute|Mute / unmute", "none|Nothing"], "solo") +
    select("Touch tap", "tap", ["mute|Mute / unmute", "solo|Solo", "zero|Reset to 0 dB", "none|Nothing"], "mute") +
    color("#22c1e8") +
    meter +
    help("The gain bar takes your color; the part above 0 dB lights in its complement so a hot channel stands out."),
};

for (const [name, body] of Object.entries(pages)) writeFileSync(join(uiDir, name), head + body + foot);

writeFileSync(
  join(uiDir, "common.css"),
  `body { padding: 6px 0 12px; }
.sd-status { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.sd-status .dot { width: 9px; height: 9px; border-radius: 50%; background: #8a8a8a; flex: none; }
.sd-status.ok .dot { background: #3ad47e; box-shadow: 0 0 6px #3ad47eaa; }
.sd-status.warn .dot { background: #e5a53a; }
.sd-status.bad .dot { background: #ff4f5e; }
.sd-help { font-size: 11px; color: #8a8a8a; line-height: 1.4; margin-top: 2px; }
details { margin: 4px 0 10px; border: 1px solid #333; border-radius: 6px; padding: 4px 8px; }
summary { cursor: pointer; font-size: 12px; color: #ddd; padding: 4px 0; }
hr { border: 0; border-top: 1px solid #333; margin: 8px 0; }
`,
);

writeFileSync(
  join(uiDir, "common.js"),
  `/* Shared property-inspector logic: Voicemeeter status line at the top of every page. */
(function () {
  const client = () => window.SDPIComponents && window.SDPIComponents.streamDeckClient;
  let status = null;
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) { if (k === "text") n.textContent = v; else n.setAttribute(k, v); }
    for (const c of children || []) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }
  function render() {
    const host = document.getElementById("status");
    if (!host) return;
    host.innerHTML = "";
    const s = status;
    let cls = "warn", text = "Waiting for the plugin…";
    if (s) {
      if (!s.installed) { cls = "bad"; text = "Voicemeeter is not installed: " + (s.error || ""); }
      else if (!s.connected) { cls = "warn"; text = "Voicemeeter is not running. Start it and the keys will follow."; }
      else { cls = "ok"; text = "Connected to " + s.name + " " + s.version; }
    }
    host.appendChild(el("sdpi-item", { label: "Voicemeeter" }, [el("div", { class: "sd-status " + cls }, [el("span", { class: "dot" }), el("span", { text })])]));
  }
  function connect() {
    const c = client();
    if (!c) return setTimeout(connect, 100);
    c.sendToPropertyInspector.subscribe((msg) => {
      const p = msg && msg.payload && msg.payload.event ? msg.payload : msg;
      if (p && p.event === "status") { status = p; render(); }
    });
    c.send("sendToPlugin", { event: "get-status" });
  }
  document.addEventListener("DOMContentLoaded", () => { render(); connect(); });
})();
`,
);
console.log("ui written");
