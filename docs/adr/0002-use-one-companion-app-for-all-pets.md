# Use one companion app for all Pets

`/openagentpet:spawn` starts the Companion app when needed, then asks it to create a Pet instance for the current Claude Code session. One app manages all Pets and the shared tray controls, avoiding duplicate background processes for parallel sessions. Quit removes all Pets and stops the app; background state updates never relaunch it. A Companion restart does not restore prior Pets.
