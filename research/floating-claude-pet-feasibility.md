# Floating Claude pet: feasibility research

Date: 2026-08-05  
Scope: a Claude Code plugin that drives an animated desktop pet, inspired by ChatGPT Desktop pets. Sources below are first-party documentation or official specifications, accessed on the date above.

## Verdict

Feasible, but it is two local components rather than one: a Claude Code plugin for lifecycle signals and a companion desktop app that owns the floating window. Claude Code's documented plugin surface consists of skills, agents, hooks, MCP servers, LSP servers, and background monitors; it does not provide a desktop-overlay window API. [Claude Code plugin docs](https://code.claude.com/docs/en/plugins)

For an MVP, target macOS first and use one small Electron companion app. Electron supports macOS, Windows, and Linux from one JavaScript codebase, and its window APIs cover transparency, always-on-top behavior, click-through, and tray controls. [Electron introduction](https://www.electronjs.org/docs/latest/) [BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) [Tray API](https://www.electronjs.org/docs/latest/api/tray)

## Confirmed facts

### Claude Code plugin boundary

- A plugin can contain skills, agents, hooks, MCP servers, LSP servers, and background monitors. Plugin metadata lives in `.claude-plugin/plugin.json`; plugin components live at the plugin root. [Claude Code plugin docs](https://code.claude.com/docs/en/plugins)
- Hooks run at specific Claude Code lifecycle events. Command hooks receive event JSON on standard input, execute in the current directory with Claude Code's environment, and may run asynchronously. `SessionStart`, tool-use, notification, and session-end events are documented hook points. [Hooks reference](https://code.claude.com/docs/en/hooks)
- Command hooks run with the user's full system permissions. A plugin that launches or controls a local process is therefore technically possible in local Claude Code, but it is security-sensitive and must be explicitly trusted by its installer. [Hooks security considerations](https://code.claude.com/docs/en/hooks)
- MCP standardizes how an AI client connects to external tools and workflows. A local MCP server can therefore expose narrow pet-control actions to Claude Code, though MCP does not itself draw a desktop overlay. [MCP introduction](https://modelcontextprotocol.io/docs/2026-07-28/getting-started/intro)
- Claude Code still applies tool permissions and managed policies. In particular, non-interactive contexts deny a permission request when no hook supplies a decision, and organization settings can restrict plugin marketplaces or permission rules. [Hooks permission requests](https://code.claude.com/docs/en/hooks) [Claude Code settings](https://code.claude.com/docs/en/settings)
- Installed plugins are copied to a cache location and cannot rely on files outside their own directory through relative paths. A companion app should therefore be installed and versioned as its own product, rather than assumed to live beside a plugin checkout. [Plugin marketplaces](https://code.claude.com/docs/en/plugin-marketplaces)

### Companion desktop app capabilities

- Electron's `BrowserWindow` supports transparent windows, `setAlwaysOnTop`, and `setIgnoreMouseEvents`. The latter passes mouse input through to the underlying window. Mouse-event forwarding while click-through is documented for macOS and Windows. [BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window) [Custom window interactions](https://www.electronjs.org/docs/latest/tutorial/custom-window-interactions)
- Electron provides a system-tray API. Linux tray behavior depends on the desktop environment: it uses StatusNotifierItem when available and falls back to GtkStatusIcon otherwise. [Tray API](https://www.electronjs.org/docs/latest/api/tray)
- Electron's login-item API supports macOS and Windows. Linux desktop autostart is conventionally implemented with a `.desktop` file in an XDG autostart directory; desktop environments may vary in their implementation. [Electron app API](https://www.electronjs.org/docs/latest/api/app) [XDG Autostart Specification](https://specifications.freedesktop.org/autostart/latest/)
- Some window behavior is platform-specific. For example, Electron documents `moveTop()` as unsupported on Wayland, and its workspace visibility API does nothing on Windows. Linux/Wayland must be treated as a separately tested target, not as an automatic consequence of the shared codebase. [BrowserWindow API](https://www.electronjs.org/docs/latest/api/browser-window)

### Existing assets

- The repository currently contains seven animated GIFs under `public/`.
- Local inspection confirms GIF89a files with alpha, ranging from 246×385 to 405×234 pixels. They can be rendered in a transparent Electron window without conversion for an MVP.
- GIFs are suitable for discrete state changes (`thinking`, `researching`, `building`, etc.). They are not evidence of a polished idle/transition system; that is a product decision.

## Recommended MVP architecture

This is a design recommendation, not a platform capability promised by Claude.

1. **Companion app:** a macOS Electron app runs one frameless, transparent, always-on-top pet window and a tray menu with Show/Hide, Pause, Quit, and optional Launch at Login.
2. **Local control API:** the app exposes a localhost-only or Unix-domain-socket command endpoint accepting a small fixed vocabulary, such as `idle`, `thinking`, `tool-use`, `needs-input`, `done`, `hide`, and `show`.
3. **Claude Code plugin:** hooks send the matching state to that local API on `SessionStart`, selected tool events, permission notifications, and `SessionEnd`. Hooks must fail harmlessly when the companion is not running.
4. **Optional later MCP server:** expose the same fixed state commands as MCP tools only if direct, model-chosen control is genuinely needed. Hooks are enough for deterministic lifecycle reactions, so MCP is not needed for the first version.

Keep the pet offline. Bundle the GIFs inside the companion app, persist only user preferences such as visibility and screen position, and do not read Claude transcripts or send them over the network.

## What belongs where

| Concern | Claude Code plugin | Companion desktop app |
| --- | --- | --- |
| Detect session and tool lifecycle | Yes, via hooks | No |
| Decide the small event-to-animation mapping | Yes | No |
| Start or request the pet process | Yes, only with explicit local-user trust | Accept and manage one running instance |
| Transparent floating window, dragging, click-through | No documented plugin support | Yes |
| GIF playback and screen placement | No | Yes |
| Tray menu and login-at-startup | No | Yes |
| Cross-platform packaging and OS permissions | No | Yes |

## Security and privacy requirements

- Treat the plugin as trusted local code. Its command hooks have the user's full permissions; do not execute user-controlled strings or shell snippets, and use fixed executable paths and fixed state values. [Hooks security considerations](https://code.claude.com/docs/en/hooks)
- The companion should accept only local, authenticated-or-unforgeable control. Do not expose an unauthenticated network listener beyond the machine.
- Render only packaged, local pet assets. Electron warns that remote content combined with desktop privileges is a severe security risk; retain context isolation and sandboxing, avoid Node integration in renderers, and do not load remote content. [Electron security guide](https://www.electronjs.org/docs/latest/tutorial/security)
- Make launch-at-login opt-in and always offer an obvious Quit/Disable control in the tray.

## Major risks and open questions

1. **Product target:** “Claude plugin” means Claude Code here. The documented plugin system is for Claude Code; this research does not establish that Claude.ai or the Claude desktop chat app can load the same plugin type.
2. **Process lifecycle:** Decide whether the plugin may start the companion automatically, or only signal an already-running app. The latter is safer and easier to distribute.
3. **Linux support:** Wayland window-manager behavior, tray availability, and click-through/always-on-top semantics need real desktop-environment testing. Do not promise Linux parity in v1.
4. **Event semantics:** Tool events do not necessarily equal human-meaningful activity. Start with a few visible states and avoid trying to infer complex model intent from transcripts.
5. **Distribution:** The plugin and companion app have different install/update paths. Establish a simple macOS-only installer story before designing a marketplace release.
6. **Accessibility:** A floating, non-focusable, animated window can distract users or obstruct controls. It needs Pause/Hide, reduced-motion support, keyboard-accessible tray controls, and remembered placement.

## Decision for the next design interview

Assume: **macOS-only MVP, companion Electron app, one local fixed-state control endpoint, hook-driven animations, existing GIFs, no cloud service, no MCP in v1.**

The first questions to settle are whether the pet starts automatically with Claude Code, which four to six states matter, and whether it is normally click-through or draggable by default.
