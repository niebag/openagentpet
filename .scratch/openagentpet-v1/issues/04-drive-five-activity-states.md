# 04 — Drive all five Activity states from Claude Code

**What to build:** Translate observable Claude Code events into the five Pet animations so that each spawned Pet reflects its own session's current activity without claiming to expose internal reasoning.

**Blocked by:** 03 — Manage per-session Pet lifecycles.

**Status:** ready-for-agent

- [ ] Spawn and turn completion select Idle.
- [ ] User prompt submission and tool completion select Thinking until a more specific event or turn completion arrives.
- [ ] Starting a built-in Claude Code web tool selects Researching from an explicit allowlist.
- [ ] Starting any other tool, including MCP and unknown tools, selects Working.
- [ ] A tool permission request selects Needs input, and no other form of waiting uses that state.
- [ ] Tool failure returns the Pet to Thinking or Idle according to the next observable lifecycle event; it does not introduce an error state.
- [ ] Overlapping activity resolves in this order: Needs input, Researching, Working, Thinking, Idle.
- [ ] Hooks update only an existing Pet and never spawn one or relaunch a stopped Companion.
- [ ] Behavioral tests cover every event mapping, state priority, tool failure, MCP tools, unknown tools, and isolation between simultaneous sessions.
