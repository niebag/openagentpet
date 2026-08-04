# 07 — Install the Claude Code integration through npm

**What to build:** Provide the public setup flow through `npx openagentpet install`, including prerequisite checks, informed confirmation, Agent integration selection, and an idempotent user-scope Claude Code plugin installation.

**Blocked by:** 04 — Drive all five Activity states from Claude Code; 06 — Select and validate local Pet packs.

**Status:** ready-for-agent

- [ ] The command exits with clear guidance when run outside macOS 13 or newer or when required Node/npm support is unavailable.
- [ ] Before the first bootstrap, the installer explains that it will install the local Companion and Claude Code plugin and asks for confirmation.
- [ ] The Agent integration selector offers Claude Code and displays Codex as Coming soon without allowing it to be selected.
- [ ] Choosing Claude Code installs the plugin, commands, and hooks at user scope.
- [ ] Declining confirmation leaves the machine unchanged.
- [ ] Rerunning the installer detects the existing installation and repairs or updates only missing or outdated setup without creating duplicates.
- [ ] A completed installation can Spawn, update, and Despawn a Pet from a fresh local Claude Code session.
- [ ] Command-level tests cover prerequisites, confirmation, cancellation, integration selection, user-scope installation, and idempotent reruns with external process and filesystem effects isolated.
