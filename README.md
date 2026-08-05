<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/header/grid.svg?title=OpenAgentPet&amp;subtitle=A+floating+Pet+for+local+Claude+Code+sessions&amp;theme=violet&amp;align=center&amp;mode=dark&amp;border=false" />
    <img src="https://shieldcn.dev/header/grid.svg?title=OpenAgentPet&amp;subtitle=A+floating+Pet+for+local+Claude+Code+sessions&amp;theme=violet&amp;align=center&amp;mode=light&amp;border=false" alt="OpenAgentPet: a floating Pet for local Claude Code sessions" />
  </picture>
</p>

<p align="center">
  <a href="https://github.com/niebag/openagentpet/blob/main/package.json">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fniebag%2Fopenagentpet%2Fmain%2Fpackage.json&amp;query=%24.version&amp;label=npm&amp;logo=npm&amp;variant=secondary&amp;size=sm&amp;mode=dark" />
      <img src="https://shieldcn.dev/badge/dynamic/json.svg?url=https%3A%2F%2Fraw.githubusercontent.com%2Fniebag%2Fopenagentpet%2Fmain%2Fpackage.json&amp;query=%24.version&amp;label=npm&amp;logo=npm&amp;variant=secondary&amp;size=sm&amp;mode=light" alt="npm package version from package.json, not yet published" />
    </picture>
  </a>
  <a href="docs/adr/0009-release-openagentpet-under-mit-with-local-pet-packs.md">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/license-MIT.svg?variant=secondary&amp;size=sm&amp;logo=opensourceinitiative&amp;mode=dark" />
      <img src="https://shieldcn.dev/badge/license-MIT.svg?variant=secondary&amp;size=sm&amp;logo=opensourceinitiative&amp;mode=light" alt="Project source license: MIT" />
    </picture>
  </a>
  <a href="#requirements">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/macOS-13%2B.svg?variant=secondary&amp;size=sm&amp;logo=apple&amp;mode=dark" />
      <img src="https://shieldcn.dev/badge/macOS-13%2B.svg?variant=secondary&amp;size=sm&amp;logo=apple&amp;mode=light" alt="Supported platform: macOS 13 or newer" />
    </picture>
  </a>
  <a href="#agent-support">
    <picture>
      <source media="(prefers-color-scheme: dark)" srcset="https://shieldcn.dev/badge/Claude_Code-supported.svg?variant=secondary&amp;size=sm&amp;logo=anthropic&amp;mode=dark" />
      <img src="https://shieldcn.dev/badge/Claude_Code-supported.svg?variant=secondary&amp;size=sm&amp;logo=anthropic&amp;mode=light" alt="Supported Agent integration: Claude Code" />
    </picture>
  </a>
</p>

OpenAgentPet turns observable activity from each local Claude Code session into a small animated Pet that floats above your macOS windows. It stays click-through while you work and sends no prompt or transcript data off your Mac.

> [!NOTE]
> OpenAgentPet is preparing its first public release. The npm package is not published yet, so the quick-start command will become available with that release.

## Preview

<table align="center">
  <tr>
    <th colspan="2" align="left">● ● ● &nbsp; macOS · Claude Code · local session</th>
  </tr>
  <tr>
    <td>
      <code>/openagentpet:spawn</code><br /><br />
      <strong>Working</strong><br />
      <sub>A Claude Code tool is running</sub>
    </td>
    <td>
      <img src="public/default-pet-pack/clawd-building.gif" width="280" alt="The current default OpenAgentPet character floating beside a local Claude Code session on macOS" />
    </td>
  </tr>
</table>

This is an illustrative preview. The real Pet has a transparent, always-on-top window that floats above ordinary macOS windows; it is not embedded in Claude Code. Each spawned local session gets its own Pet.

The preview uses the current default artwork in this repository. Its attribution and redistribution rights are still being verified before public release. No license or redistribution claim is made for that artwork here.

## Requirements

- macOS 13 or newer
- Node.js 22.12 or newer, with npm
- Claude Code installed locally

Windows, Linux, Claude Desktop, Claude on the web, and remote Claude Code sessions are not supported.

## Quick start

Install the Companion app and the Claude Code plugin:

```sh
npx openagentpet install
```

Choose **Claude Code** in the installer and confirm the user-scope installation. Start a fresh Claude Code session, then run:

```text
/openagentpet:spawn
```

Remove that session's Pet when you no longer need it:

```text
/openagentpet:despawn
```

Spawn and Despawn are explicit and idempotent. Running Spawn twice refreshes the existing Pet for that session; running Despawn when no Pet exists is harmless. Ending a Claude Code session also removes its Pet.

## Activity states

OpenAgentPet describes observable Claude Code events, not the model's thoughts, intent, mood, progress, or success.

| Activity state | Shown when |
| --- | --- |
| **Idle** | A Pet is spawned or a Claude Code turn completes. |
| **Thinking** | You submit a prompt or a tool completes. |
| **Researching** | A built-in Claude Code web tool is running. |
| **Working** | Any other tool is running, including MCP tools. |
| **Needs input** | Claude Code is waiting for approval of a tool permission request. |

When events overlap, the display priority is Needs input, Researching, Working, Thinking, then Idle.

## Tray controls

One tray menu controls every Pet in the current Companion run:

- **Arrange Pets** temporarily enables pointer input so you can drag Pets. Leaving Arrange mode restores click-through behavior and keeps their positions until the Companion quits.
- **Hide Pets** removes all Pets from view without stopping their Activity updates. **Show Pets** restores them in their current states.
- **Reduced Motion** shows a stable frame for each Pet's current Activity state instead of playing its GIF.
- **Quit OpenAgentPet** removes every Pet and stops the Companion. Restarting the Companion does not restore old Pets.

## Pet packs

A Pet pack is one local `manifest.json` file plus exactly five different, decodable, transparent GIFs: one each for Idle, Thinking, Researching, Working, and Needs input. Asset paths must stay inside the pack directory.

Put custom packs in:

```text
~/Library/Application Support/OpenAgentPet/Pet Packs/
```

Choose the built-in default or an available custom pack interactively:

```sh
openagentpet pack use
```

Or select a pack by path:

```sh
openagentpet pack use "/path/to/My Pet"
```

A valid selection updates current Pets and future Pets. An invalid pack leaves the current selection unchanged. See [Pet packs](docs/pet-packs.md) for the manifest format and validation rules.

## Privacy

OpenAgentPet has no analytics, telemetry, crash reporting, account, cloud service, or remote-control endpoint.

The following data stays on your Mac:

- prompts, transcripts, project and repository paths, tool arguments, and tool results;
- Pet pack manifests and GIFs;
- the selected Pet pack path and hook state used to resolve concurrent Activity states;
- each opaque Session identifier and all Companion state.

The Claude Code plugin talks to the Companion through a Unix-domain socket restricted to the current macOS user. Requests sent to that socket contain only the protocol version and one of these fixed payloads:

- Spawn: an opaque Session identifier and the Idle Activity state;
- Activity update: an opaque Session identifier and one of the five Activity states;
- Despawn or session end: an opaque Session identifier;
- Pet pack selection: the local path to the selected pack.

The Companion replies with a success result, a failure result, or a failure result with a local error message. Responses do not include the Session identifier, Activity state, or Pet pack path.

npm network access may occur when you run `npx openagentpet install`, including a rerun; when a confirmed install, repair, or update runs `npm install --global`; after a user-invoked Spawn or Despawn triggers the at-most-once-per-24-hours version check; or after you explicitly confirm an available update. Companion launch, Activity hooks, Pet pack selection, and background timers do not contact npm.

## Updates

Rerun the installer to inspect and repair or update the local Companion and user-scope Claude Code plugin:

```sh
npx openagentpet install
```

After Spawn or Despawn, OpenAgentPet may report a newer compatible npm release. It shows the installed and available versions first and never installs the update without confirmation. Declining or failing an update does not block the Pet command you already ran.

## Removal

Quit OpenAgentPet from the tray, then remove the user-scope plugin, its marketplace entry, and the npm package:

```sh
claude plugin uninstall openagentpet@openagentpet --scope user
claude plugin marketplace remove openagentpet --scope user
npm uninstall --global openagentpet
```

These commands do not delete custom Pet packs or selection data under `~/Library/Application Support/OpenAgentPet/`.

## Agent support

Claude Code is the only supported Agent integration in the first release. Codex is **Coming soon**. OpenAgentPet does not currently support Claude Desktop, Claude on the web, or remote sessions.

## License and independence

OpenAgentPet is an independent open-source project and is not affiliated with or endorsed by Anthropic. Project-owned source is released under the [MIT licensing decision](docs/adr/0009-release-openagentpet-under-mit-with-local-pet-packs.md). That statement does not apply to the current default Pet artwork while its rights are being verified.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). OpenAgentPet uses Conventional Commits.
