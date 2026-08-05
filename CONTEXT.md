# OpenAgentPet

A public macOS companion for people using local Claude Code sessions. It provides ambient visibility of Claude Code activity without becoming a general desktop assistant, and lets users select local Pet packs.

## Language

**Pet**:
The animated floating companion, using the selected Pet pack, that represents the current state of a local Claude Code session.
_Avoid_: assistant, chatbot, overlay

**Pet pack**:
A local manifest and exactly five transparent GIF state animations: Idle, Thinking, Researching, Working, and Needs input. OpenAgentPet ships a default Pet pack; custom Pet packs have no GUI editor, import wizard, gallery, or additional media formats in v1.
_Avoid_: theme, skin, avatar

**Select Pet pack**:
The user-initiated CLI action `openagentpet pack use` that interactively selects one local Pet pack for new and existing Pets. `openagentpet pack use <path>` is the non-interactive form.
_Avoid_: import, upload

**Activity state**:
A small, user-visible category of observable Claude Code activity that selects the Pet's animation. It never claims to reveal the model's internal intent or reasoning.
_Avoid_: mood, intent, model state

When several states apply, their display priority is: Needs input, Researching, Working, Thinking, then Idle.

**Thinking**:
The temporary Activity state after a user prompt is submitted or a tool completes, before a more specific observable event or session completion occurs.
_Avoid_: reasoning, internal thought

**Researching**:
The Activity state selected only while a built-in Claude Code web tool is running. MCP tools are always Working in v1.
_Avoid_: investigating, learning

**Working**:
The Activity state selected while any Claude Code tool is running, regardless of whether it reads, edits, executes, or calls an integration. A tool failure has no separate v1 state and returns to Thinking or Idle.
_Avoid_: coding, building

**Needs input**:
The Activity state selected only while Claude Code is waiting for a user to approve a tool permission request.
_Avoid_: blocked, waiting for feedback

**Idle**:
The Activity state shown after Spawn and after a Claude Code turn completes, until another observable activity begins or the Pet is Despawned.
_Avoid_: finished, inactive

**Locked**:
The global interaction state in which Pets keep their current position and size and are click-through. Pets are unlocked by default, allowing the user to reposition and resize them.
_Avoid_: Arrange mode, edit mode, drag mode

**Hidden**:
A global display mode in which no Pet is visible but each Pet instance continues to receive Activity state updates.
_Avoid_: paused, stopped

**Reduced motion**:
The accessibility mode in which a Pet displays a static image for its current Activity state instead of playing a GIF.
_Avoid_: paused, hidden

**Companion app**:
The single local macOS accessory application that manages all Pet instances and their shared tray controls. It lives only in the tray, with no Dock icon, Cmd+Tab entry, or normal application menu bar.
_Avoid_: pet process, per-session app

**Session identifier**:
An opaque, local-only identifier used to bind one Pet instance to one Claude Code session. It contains no transcript or prompt content.
_Avoid_: session name, transcript ID

**User**:
A person running Claude Code locally on macOS 13 or newer with Node/npm available, who installs the plugin and Companion app to see Pet instances for their sessions.
_Avoid_: operator, customer

**Local session**:
A Claude Code session running on the same macOS machine as the Companion app. Cloud, remote, and web sessions are not Local sessions.
_Avoid_: remote session, web session

**Agent integration**:
The adapter that translates one coding agent's local session events into OpenAgentPet Activity states. `openagentpet install` presents Claude Code as the only selectable v1 integration and shows Codex as Coming soon.
_Avoid_: universal agent support, multi-agent support

**npm bootstrap**:
The npm-distributed installation and launch path for the Companion app. `openagentpet install` provides the interactive setup flow and installs the Claude Code plugin at user scope. Node/npm is an explicit v1 prerequisite, and first installation requires the user's confirmation.
_Avoid_: native installer, DMG

**Pet instance**:
One Pet created for exactly one Claude Code session. Several Pet instances may be visible at once when several sessions have been spawned.
_Avoid_: global pet, shared pet

**Pet label**:
The read-only name shown beneath a Pet, captured from the basename of the Claude Code session's working directory when the Pet is Spawned. It is display context only and does not identify or bind the session.
_Avoid_: session name, workspace binding, project identifier

**Session binding**:
The fixed relationship between a Pet instance and the Claude Code session that created it.
_Avoid_: workspace binding, user binding

**Spawn**:
The explicit, user-initiated, idempotent creation of a Pet instance for the current Claude Code session. Claude does not invoke Spawn autonomously. Repeating Spawn refreshes that session's existing Pet rather than creating another.
_Avoid_: activate, open

**Despawn**:
The user-initiated, idempotent removal of a Pet instance before or when its bound Claude Code session ends. Claude does not invoke Despawn autonomously.
_Avoid_: close, kill
