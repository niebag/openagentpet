# 09 — Create the repository README with ShieldCN Studio

**What to build:** Create a clear public README for OpenAgentPet, using [ShieldCN README Studio](https://shieldcn.dev/studio) for the header, badges, and visual structure. The README should show the product quickly, then give users accurate installation, usage, privacy, and Pet pack guidance.

**Blocked by:** 05 — Add tray and window controls; 08 — Notify users about optional updates.

**Status:** ready-for-agent

- [ ] The README opens with the OpenAgentPet name, a short description, and a product preview that shows the floating macOS Pet experience.
- [ ] ShieldCN Studio is used to create a restrained header and badge row for npm version, MIT license, macOS support, and Claude Code support.
- [ ] Every badge links to its relevant destination, has useful alt text, and remains optional; essential project information is also present as text.
- [ ] The quick start documents the macOS 13+ and Node/npm prerequisites, `npx openagentpet install`, `/openagentpet:spawn`, and `/openagentpet:despawn`.
- [ ] The README explains per-session Pets, the five Activity states, tray controls, Reduced motion, local Pet pack selection, and idempotent lifecycle commands.
- [ ] The privacy section states exactly what stays local, what crosses the Unix-domain socket, and when npm network access may occur.
- [ ] The Pet pack section documents the five-GIF contract and the interactive and path-based `openagentpet pack use` commands.
- [ ] Installation, update, and removal instructions match the implemented commands and do not promise unsupported behavior.
- [ ] The README states that OpenAgentPet is an independent open-source project and does not imply endorsement by Anthropic.
- [ ] The default character preview and attribution do not claim redistribution rights that have not been confirmed.
- [ ] Codex is listed only as Coming soon, and Windows, Linux, Claude Desktop, and remote sessions are not presented as supported.
- [ ] The generated Markdown renders correctly on GitHub in light and dark mode, with working links and copyable commands.
