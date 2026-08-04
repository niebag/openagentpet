# 08 — Notify users about optional updates

**What to build:** Tell users when a newer npm release is available after they invoke an OpenAgentPet command, while keeping checks infrequent and every update explicitly opt-in.

**Blocked by:** 07 — Install the Claude Code integration through npm.

**Status:** ready-for-agent

- [ ] A user-invoked `/openagentpet:spawn` or `/openagentpet:despawn` may trigger an npm version check only when no successful check has run in the previous 24 hours.
- [ ] No background process, timer, hook-only event, or Companion launch performs a version check.
- [ ] When a newer compatible release exists, the user sees the installed and available versions and can accept or decline the update.
- [ ] Declining or failing an update leaves the installed version usable and does not block the requested Pet command.
- [ ] Accepting the update runs the npm update only after explicit confirmation and reports success or a useful failure.
- [ ] Version checks and updates send no Session identifier, Activity state, prompt, transcript, project data, or Pet pack data.
- [ ] Behavioral tests cover the 24-hour limit, no-update result, declined update, confirmed update, network failure, and the absence of background checks.
