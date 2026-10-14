/* Shared property-inspector logic: Voicemeeter status line at the top of every page. */
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
