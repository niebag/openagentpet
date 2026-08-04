# 03 — Manage per-session Pet lifecycles

**What to build:** Let each Claude Code session manage one independent Pet from Spawn through cleanup. Users can run several sessions at once, refresh an existing Pet safely, Despawn it early, or let session end remove it automatically.

**Blocked by:** 02 — Spawn one Idle Pet from Claude Code.

**Status:** ready-for-agent

- [ ] Repeating `/openagentpet:spawn` for the same Session identifier refreshes the existing Pet without creating a duplicate.
- [ ] Spawning from different Claude Code sessions creates one independently bound Pet per session in the same Companion process.
- [ ] `/openagentpet:despawn` removes only the invoking session's Pet and succeeds harmlessly when that Pet is already absent.
- [ ] A Claude Code session-end event removes the Pet bound to that session.
- [ ] Closing or quitting the Companion removes all Pets, and Activity state hooks do not relaunch it.
- [ ] Starting the Companion again begins with no restored Pets; a new Spawn is required.
- [ ] Behavioral tests cover repeated Spawn, repeated Despawn, concurrent sessions, session-end cleanup, Quit, and restart behavior.
