# OpenAgentPet v1

Status: ready-for-agent

## Problem Statement

Claude Code users can run several local sessions at once, but the application does not provide a small, persistent desktop indicator for each session. Users have to return to a terminal to see whether a session is idle, using a tool, researching, or waiting for permission.

The desired product is an optional animated Pet that stays visible without getting in the way. It must be explicit to install and spawn, keep session data local, support several concurrent Claude Code sessions, and remain simple enough to distribute publicly as an open-source first release.

## Solution

OpenAgentPet will provide a Claude Code plugin and one local macOS Companion app. A user installs both through the npm bootstrap, then invokes `/openagentpet:spawn` in a Claude Code session to create one Pet instance bound to that session. Each additional spawned session gets its own Pet. `/openagentpet:despawn` removes the current session's Pet, and ending the session removes it automatically.

Claude Code hooks translate observable session events into five Activity states: Idle, Thinking, Researching, Working, and Needs input. The plugin sends only a Session identifier, lifecycle commands, and Activity states to the Companion over a Unix-domain socket. The Companion owns the floating Electron windows, Pet pack rendering, tray controls, and process lifecycle.

OpenAgentPet ships with a default Pet pack built from the repository's GIF assets and supports local custom Pet packs with the same five-state contract. The initial release supports macOS 13 or newer, requires Node/npm, is distributed through npm and an independent GitHub-backed Claude Code marketplace, and uses the MIT License.

## User Stories

1. As a Claude Code user, I want to install OpenAgentPet with `npx openagentpet install`, so that I can set it up without downloading a separate installer.
2. As a first-time user, I want the installer to explain that it will install a local Companion app and Claude Code plugin, so that I know what will change on my machine.
3. As a first-time user, I want to confirm the npm bootstrap before it runs, so that installation is explicit.
4. As a user, I want the installer to offer Claude Code as the supported Agent integration, so that the available choice is clear.
5. As a user, I want the installer to show Codex as Coming soon, so that the intended roadmap is visible without implying current support.
6. As a user, I want the Claude Code plugin installed at user scope, so that it is available in all of my local projects.
7. As a user, I want installation to be idempotent, so that rerunning it repairs or confirms setup instead of duplicating it.
8. As a Claude Code user, I want to invoke `/openagentpet:spawn`, so that a Pet appears for my current session.
9. As a Claude Code user, I want Spawn to require my explicit command, so that Claude cannot create desktop windows on its own.
10. As a Claude Code user, I want repeated Spawn commands in one session to refresh the existing Pet, so that I never get duplicates for that session.
11. As a Claude Code user, I want different sessions to create separate Pets, so that I can monitor parallel work.
12. As a Claude Code user, I want each Pet bound to the session that spawned it, so that its animation represents the correct session.
13. As a Claude Code user, I want a newly spawned Pet to begin in Idle, so that its initial state is predictable.
14. As a Claude Code user, I want Spawn to start the Companion app when needed, so that I do not have to launch it separately.
15. As a Claude Code user, I want state hooks not to restart a Companion app that I deliberately quit, so that Quit is respected.
16. As a Claude Code user, I want to invoke `/openagentpet:despawn`, so that I can remove the current session's Pet early.
17. As a Claude Code user, I want Despawn to be idempotent, so that removing an absent Pet is harmless.
18. As a Claude Code user, I want ending a session to remove its Pet, so that orphaned Pets do not remain on screen.
19. As a user, I want quitting the Companion app to remove all Pets, so that one action stops the product completely.
20. As a user, I want a Companion restart to start empty, so that old Session bindings are not restored incorrectly.
21. As a user, I want the Pet to show Thinking after I submit a prompt, so that I can see that the turn has started.
22. As a user, I want the Pet to show Working while a Claude Code tool runs, so that tool activity is visible.
23. As a user, I want the Pet to show Researching only while a built-in Claude Code web tool runs, so that web research is distinct from other work.
24. As a user, I want MCP tool activity to show Working, so that v1 does not guess what third-party tools are doing.
25. As a user, I want the Pet to return to Thinking after a tool completes, so that the transition between tool calls and completion is visible.
26. As a user, I want a failed tool to return to Thinking or Idle without a separate error animation, so that the first version keeps a small state model.
27. As a user, I want the Pet to show Needs input while Claude Code waits for tool permission approval, so that I notice the actionable interruption.
28. As a user, I want Needs input to take priority over every other Activity state, so that an approval request is not hidden.
29. As a user, I want Researching to take priority over Working and Thinking, so that concurrent observable events resolve consistently.
30. As a user, I want Working to take priority over Thinking, so that an active tool is represented accurately.
31. As a user, I want the Pet to return to Idle when the Claude Code turn completes, so that completion is visible at a glance.
32. As a user, I want Activity states to describe observable events rather than Claude's internal reasoning or mood, so that the product does not make misleading claims.
33. As a user, I want each Pet window to have a transparent background, so that only the character appears on my desktop.
34. As a user, I want Pets to stay above ordinary windows, so that they remain visible while I work.
35. As a user, I want Pets to be click-through during normal use, so that they do not block controls underneath them.
36. As a user, I want to enable Arrange mode from the tray, so that I can reposition Pets intentionally.
37. As a user, I want Arrange mode to make Pets accept pointer input temporarily, so that dragging works only when requested.
38. As a user, I want to hide all Pets from the tray without stopping them, so that I can clear my screen temporarily.
39. As a user, I want hidden Pets to keep receiving state updates, so that they are current when shown again.
40. As a user who prefers reduced motion, I want each Activity state to use a static frame, so that I can use the product without animated GIF playback.
41. As a user, I want one tray menu to control all Pets, so that parallel sessions do not create duplicate app controls.
42. As a user, I want to select a Pet pack with `openagentpet pack use`, so that I can change the appearance of all current and future Pets.
43. As a user, I want `openagentpet pack use` to present my available local Pet packs, so that I do not need to remember paths.
44. As an automation author, I want `openagentpet pack use <path>` to select a pack non-interactively, so that setup can be scripted.
45. As a Pet pack author, I want a small manifest and exactly five transparent GIFs, so that I can create a pack without a dedicated editor.
46. As a Pet pack author, I want invalid or incomplete packs rejected with a useful message, so that rendering does not fail silently.
47. As a user, I want a selected Pet pack applied to existing and future Pets, so that the display remains consistent.
48. As a user, I want the repository's current character animations available as the default Pet pack, so that OpenAgentPet works immediately after installation.
49. As a privacy-conscious user, I want OpenAgentPet to receive only an opaque Session identifier and Activity state, so that prompts and transcripts never enter the Companion.
50. As a privacy-conscious user, I want session control to stay on a Unix-domain socket owned by my macOS account, so that no localhost TCP service is exposed.
51. As a privacy-conscious user, I want no analytics, crash reporting, or cloud service, so that use remains local.
52. As a user, I want network access limited to explicit installation, version checks, and confirmed updates, so that desktop activity is not sent elsewhere.
53. As a user, I want update checks to run at most once per day and only after I invoke an OpenAgentPet command, so that checks are predictable and do not require a background updater.
54. As a user, I want to be told when a newer version is available, so that I can decide whether to install it.
55. As a user, I want every update to require confirmation, so that OpenAgentPet never replaces local software silently.
56. As a macOS user, I want clear feedback when Node/npm or macOS 13 is missing, so that unsupported setups fail cleanly.
57. As a maintainer, I want OpenAgentPet released under MIT, so that the code and trust-sensitive local behavior can be inspected and reused.
58. As a maintainer, I want the first public plugin release hosted in a project-controlled GitHub marketplace, so that Anthropic marketplace review does not block v1.

## Implementation Decisions

- Build two runtime parts: a Claude Code plugin containing the user commands and hooks, and one Electron Companion app distributed through the `openagentpet` npm package.
- Support macOS 13 or newer only. Node and npm are prerequisites rather than bundled dependencies.
- Keep `/openagentpet:spawn` and `/openagentpet:despawn` as the only Pet lifecycle commands exposed inside Claude Code v1.
- Spawn and Despawn are user-only, session-scoped, and idempotent. Hooks may update or remove an existing Pet but may not create one.
- Use one opaque local Session identifier per Claude Code session. The identifier must not contain prompts, transcript text, project paths, repository names, tool arguments, or tool results.
- Run one Companion process per macOS user. It owns every Pet instance and the shared tray menu.
- Do not restore Pets after a Companion restart. Spawn is the only operation allowed to launch the Companion after it has stopped.
- Send a small fixed command vocabulary over a Unix-domain socket: Spawn, Despawn, set Activity state, and session end. Tray actions remain inside the Companion.
- Restrict the socket to the current user and validate every inbound message. Unknown commands, malformed payloads, oversized payloads, and unsupported protocol versions must be rejected without changing Pet state.
- Keep the local protocol versioned, but ship only one protocol version in v1. Compatibility machinery beyond a clear version mismatch error is not required.
- Translate Claude Code's observable events at the Agent integration boundary. Prompt submission selects Thinking; built-in web tool start selects Researching; any other tool start selects Working; tool completion selects Thinking; permission approval requests select Needs input; turn completion selects Idle; session end despawns.
- Treat built-in Claude Code web tools as an explicit allowlist. MCP tools and unknown tools select Working.
- Resolve overlapping states with this fixed priority: Needs input, Researching, Working, Thinking, Idle.
- Do not infer model reasoning, intent, progress percentage, emotion, or task success.
- Use Electron transparent, frameless, always-on-top windows for Pet instances. Normal Pet windows ignore mouse events and forward them to the window underneath.
- Use Electron's tray support for Show/Hide Pets, Arrange mode, Reduced motion, and Quit.
- Arrange mode temporarily disables click-through and allows each Pet to be dragged. Leaving Arrange mode preserves the last position for the current Companion run.
- Hidden is global. It changes visibility only; Pet instances and their Activity states stay active.
- Reduced motion is global. Render a stable frame for the current Activity state rather than playing the GIF.
- Quit closes every Pet and the Companion process. No login item, launch agent, or background hook may restart it.
- Define a Pet pack as one manifest plus exactly five local transparent GIF files keyed to Idle, Thinking, Researching, Working, and Needs input.
- Validate the manifest, required state keys, file existence, local paths, GIF format, and image decodability before activating a Pet pack. Keep the previously selected pack active if validation fails.
- `openagentpet pack use` is interactive. `openagentpet pack use <path>` is its non-interactive equivalent. A successful selection updates existing and future Pets.
- Ship a default Pet pack assembled from the current repository assets. The exact five-file mapping must be recorded with the pack manifest, not embedded in state logic.
- Do not claim that the default GIF assets are MIT-licensed until their ownership and redistribution rights are confirmed. Public release requires either documented permission/provenance or replacement assets.
- `npx openagentpet install` provides the setup flow. It shows Claude Code as available and Codex as Coming soon, then installs the Claude Code plugin at user scope.
- Make install idempotent. A repeat run should detect the existing setup and update or repair only what is needed.
- Require explicit confirmation before the first Companion bootstrap and before installing any update.
- Check the npm registry for a newer version at most once in 24 hours, triggered by a user-invoked OpenAgentPet command. Do not run a background updater.
- Keep all runtime control and Pet data local. Network access is limited to npm installation, the user-triggered version check, and a confirmed update.
- Include no analytics, telemetry, crash reporting, transcript storage, remote control, or cloud API.
- Publish the plugin through an independent GitHub-backed Claude Code marketplace for v1. Anthropic's community marketplace may be considered after the release is stable.
- Release project-owned source under MIT. Third-party or externally sourced media must retain its own verified licensing terms.

## Testing Decisions

- Use one primary behavioral seam: submit a Claude Code hook event or public CLI command, then observe the Companion's resulting Pet registry and window instructions. Tests should assert externally visible lifecycle, state, visibility, pack, and update behavior rather than internal helper calls.
- Put the Unix-domain socket transport and Electron window operations behind the same Companion command boundary. Integration tests may replace the actual window operations with a recording adapter, but should otherwise exercise the real command parsing, validation, state priority, and Pet registry.
- Cover Spawn, repeated Spawn, Despawn, repeated Despawn, session-end cleanup, parallel sessions, Quit behavior, and the rule that state hooks cannot launch or create a Pet.
- Cover every Claude event-to-Activity-state mapping, including built-in web tools, MCP or unknown tools, permission requests, tool completion, failures, turn completion, and priority when events overlap.
- Cover malformed, oversized, unknown, cross-user, and unsupported-version socket messages at the trust boundary. A rejected message must not alter existing Pet state.
- Cover default and custom Pet pack validation, failed selection preserving the active pack, interactive and path-based selection, and applying a successful change to existing and future Pets.
- Cover install reruns, missing prerequisites, user-scope plugin installation, first-install confirmation, once-per-24-hours version checks, declined updates, and confirmed updates through command-level tests with npm/network calls stubbed.
- Add one macOS smoke test using the real Electron app. It should verify that several Pet windows can appear, remain always on top, preserve transparency, ignore clicks outside Arrange mode, accept dragging in Arrange mode, hide and show globally, render a static frame in Reduced motion, and disappear on Quit.
- Keep the macOS smoke test small. Native window behavior is the only concern that cannot be established through the main headless behavioral seam.
- There is no prior test suite in the repository. The first implementation should establish this command-to-observable-state pattern without adding separate unit-test seams for private modules.

## Out of Scope

- Windows and Linux support.
- Codex integration beyond showing Coming soon during installation.
- Claude Desktop, Claude web, remote Claude Code sessions, or cloud-hosted sessions.
- Autonomous Spawn or Despawn initiated by Claude.
- More than one Pet for a single Claude Code session.
- Restoring Pets after the Companion restarts.
- Starting at login, a launch agent, or automatic background relaunch.
- A native DMG, Mac App Store release, Homebrew package, or standalone installer.
- Submission to Anthropic's community marketplace for the initial release.
- Automatic or silent installation and updates.
- A background update service or checks unrelated to a user-invoked command.
- Transcript, prompt, tool argument, tool result, repository, or project-name display.
- Analytics, telemetry, crash reporting, accounts, sync, remote control, or cloud storage.
- Progress percentages, model thoughts, emotions, success detection, or a separate error state.
- Per-Pet tray controls, per-Pet visibility settings, or per-Pet Reduced motion settings.
- Persisting window positions between Companion runs.
- A Pet pack editor, import wizard, package registry, gallery, marketplace, download flow, or remote pack source.
- Media formats other than transparent GIFs.
- Optional state animations, extra Activity states, or packs with fewer or more than five state files.
- Interactive Pet behaviors beyond repositioning in Arrange mode.
- Multiple simultaneous selected Pet packs or a different pack per session.
- A general desktop assistant or non-agent desktop character platform.

## Further Notes

- The repository currently contains seven candidate GIF assets while a Pet pack requires five. The default manifest must choose one file for each Activity state; unused files can remain source material but are not part of the v1 runtime contract.
- The current assets are technically suitable for a transparent animated default pack, but their provenance and redistribution rights are a public-release gate. Using the OpenAgentPet name does not settle rights in the artwork.
- The npm bootstrap should be tested on a clean macOS 13 environment early. If macOS execution or Gatekeeper behavior prevents a reliable npm-launched Companion, adjust the packaging mechanism while preserving the explicit `npx openagentpet install` user flow.
- Product and protocol decisions already recorded in the repository ADRs remain authoritative. The earlier naming ADR is superseded by the Pet pack ADR.
