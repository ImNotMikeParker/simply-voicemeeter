# Simply Voicemeeter

Voicemeeter on your Stream Deck, live. Built on VB-Audio's official Remote API, so every key follows what Voicemeeter
is actually doing, including changes you make in Voicemeeter itself. Works with Voicemeeter, Banana and Potato on
Windows. Not affiliated with VB-Audio.

**Why another one?**

- **Dropdowns, not indexes.** Pick strips and buses by the labels you gave them in Voicemeeter (VOICE, GAMES, …).
  Output devices come from Voicemeeter's own device list.
- **Meters.** Mute and Gain keys carry a live level meter. The Gain dial shows gain position and level on the strip.
- **Output device swapping that shows the truth.** One key swaps a bus between two devices (headset / speakers) and
  lights up for whichever is live, because it reads the device back rather than remembering a mode.
- **Scripts in Voicemeeter's own syntax**, so anything from the Remote API reference or the Macro Buttons app pastes
  straight in. Press / hold, toggle, or push-to-talk, with optional live state from any parameter.
- **Polite polling.** Voicemeeter's dirty flag every 100 ms, levels at 20 fps only while a meter is on screen.

## Actions

**Keys**

- **Mute**: strip or bus. Toggle, push-to-talk, mute, or unmute. Live state and meter.
- **Gain**: press sets one value, hold sets another, optional fade time. Live dB and meter.
- **Output Device**: send a bus to a device, or swap between two. Optional label and image per device.
- **Route**: toggle a strip's A1 / A2 / A3 / B1 / B2 assignment.
- **Macro Button**: toggle or push a Voicemeeter Macro Button, state shown live.
- **Script**: Voicemeeter commands with press / hold, toggle, or push-to-talk modes.
- **Preset**: recall a preset scene or load an XML config.
- **Voicemeeter**: edition and version; press to show the window, hold to restart the audio engine.

**Stream Deck + dial**

- **Gain**: label, dB, gain bar in your color with a complementary "hot" segment above 0 dB, and a level meter.
  Rotate for gain, press for solo, tap for mute (each configurable).

## Setup

Install Voicemeeter and run it. Place any Simply Voicemeeter action. That is the whole setup: the plugin finds
Voicemeeter's Remote DLL through the registry and logs in. If Voicemeeter is closed, keys say so and recover when it
comes back.

## How it works

`VoicemeeterRemote64.dll` ships with Voicemeeter and exposes a plain C API. The plugin calls it from Node through
[koffi](https://koffi.dev), a prebuilt Node-API FFI binding, so there is no helper process and nothing to compile.

- `src/vm/api.ts`: the DLL binding (login, parameters, scripts, levels, macro buttons, device enumeration).
- `src/vm/state.ts`: the live model, layouts for the three editions, polling, level meters, commands.
- Everything else is Stream Deck rendering and settings.

Voicemeeter reads device names back truncated to 31 characters; device matching compares on that length.

## Development

```bash
npm install && npm run deps       # deps: koffi, installed inside the plugin folder
npm run icons && npm run ui
npm run build
npm run link                      # then restart the Stream Deck app once
npm run restart:force
npm run validate
npm run probe                     # dump the live model and watch levels for 6 s, no Stream Deck needed
npm run pack
```

Logs: `com.mjp.simplyvoicemeeter.sdPlugin/logs/`.

## Credits and AI disclosure

Voicemeeter and the Remote API are by VB-Audio Software; the API is free to use in any project per its licence.
The plugin was designed, tested and debugged by Mike Parker with Claude (Anthropic) writing most of the code under
direction. License: MIT.
