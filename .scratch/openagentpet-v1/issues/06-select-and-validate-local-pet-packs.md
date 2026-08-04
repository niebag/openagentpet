# 06 — Select and validate local Pet packs

**What to build:** Let users choose a local Pet pack while keeping the runtime contract small and predictable: one manifest and exactly five transparent GIFs, one for each Activity state.

**Blocked by:** 04 — Drive all five Activity states from Claude Code.

**Status:** ready-for-agent

- [ ] A valid Pet pack contains a manifest with exactly one local transparent GIF for Idle, Thinking, Researching, Working, and Needs input.
- [ ] The default pack records its five asset mappings in its manifest rather than in Activity state logic.
- [ ] `openagentpet pack use` interactively lists the built-in default and valid packs found in the documented user-scoped Pet pack directory.
- [ ] `openagentpet pack use <path>` validates and selects a pack without interactive input.
- [ ] Validation checks the required state keys, local file paths, GIF format, file existence, and image decodability before activation.
- [ ] A failed selection gives a useful error and leaves the current Pet pack active.
- [ ] A successful selection updates all existing Pets and becomes the default for future Pets.
- [ ] Pet pack selection and rendering require no network access.
- [ ] Behavioral tests cover the default pack, interactive and path-based selection, malformed packs, failed selection rollback, and updates to existing and future Pets.
