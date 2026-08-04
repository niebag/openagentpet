# 10 — Validate the public macOS release

**What to build:** Produce a release candidate that installs from an npm artifact on a clean supported Mac, exposes the Claude Code plugin through the independent marketplace, and meets the project's privacy, licensing, and native-window requirements.

**Blocked by:** 09 — Create the repository README with ShieldCN Studio.

**Status:** ready-for-agent

- [ ] The npm package can be packed, installed, and run on a clean macOS 13 or newer environment with only supported Node/npm prerequisites.
- [ ] Package metadata, command entry points, included files, versioning, and MIT licensing are valid for public npm distribution.
- [ ] The GitHub-backed Claude Code marketplace metadata installs the user-scope plugin and points to the intended release.
- [ ] The default Pet pack has documented redistribution rights compatible with the public release, or the unverified assets have been replaced before packaging.
- [ ] Project-owned source is covered by MIT without incorrectly applying that license to third-party assets.
- [ ] Installation and removal instructions, prerequisites, privacy behavior, update behavior, Pet pack format, and macOS-only support are documented.
- [ ] A clean-machine smoke test covers install, parallel Spawn, all Activity states, Despawn, Pet pack selection, tray controls, update decline, session-end cleanup, and Quit.
- [ ] The release candidate performs no runtime network request except the documented user-triggered npm version check and confirmed installation or update.
- [ ] Gatekeeper or npm-launched Electron behavior does not prevent the documented setup flow; any packaging adjustment preserves `npx openagentpet install` as the user entry point.
