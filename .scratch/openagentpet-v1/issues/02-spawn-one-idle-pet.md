# 02 — Spawn one Idle Pet from Claude Code

**What to build:** Make `/openagentpet:spawn` create the first usable Pet. The command starts the Companion app when needed, sends a session-scoped Spawn command over a protected Unix-domain socket, and displays one transparent, always-on-top Pet in Idle.

**Blocked by:** 01 — Enforce Conventional Commits locally.

**Status:** ready-for-agent

- [ ] Invoking `/openagentpet:spawn` from a supported local Claude Code session starts the Companion when it is not already running.
- [ ] The Companion displays one frameless, transparent, always-on-top Pet using the default Pet pack's Idle animation.
- [ ] The plugin sends only a protocol version, command type, opaque Session identifier, and Activity state; it sends no prompt, transcript, path, tool argument, or tool result.
- [ ] The Companion accepts control only through a Unix-domain socket restricted to the current macOS user.
- [ ] Malformed, unknown, oversized, or unsupported-version messages are rejected without creating or changing a Pet.
- [ ] A command-level test exercises the real command parsing and Pet creation flow through the agreed behavioral seam, with window operations recorded instead of rendered.
- [ ] A local development run demonstrates the real Electron window on macOS 13 or newer.
