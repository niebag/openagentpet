# Distribute the Companion through npm

Public v1 requires Node/npm and distributes the macOS Companion app as an npm package. This lets the Claude Code plugin use one familiar install path rather than requiring a separate DMG or App Store release. The plugin asks for explicit confirmation before performing the first npm bootstrap and before any available update. It checks npm at most once per day after a user invokes an OpenAgentPet command.
