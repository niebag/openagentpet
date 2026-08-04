# 05 — Add tray and window controls

**What to build:** Give users one macOS tray menu for controlling all visible Pets while keeping the floating windows unobtrusive during normal work.

**Blocked by:** 03 — Manage per-session Pet lifecycles.

**Status:** ready-for-agent

- [ ] Pet windows ignore pointer input during normal use and allow clicks to reach the windows beneath them.
- [ ] Arrange mode temporarily enables pointer input and lets each Pet be dragged to a new position.
- [ ] Leaving Arrange mode restores click-through behavior and keeps each Pet's new position for the current Companion run.
- [ ] Hide removes every Pet from view without removing Session bindings or stopping Activity state updates; Show restores them in their current states.
- [ ] Reduced motion displays a stable frame for each Pet's current Activity state instead of playing its GIF.
- [ ] Quit removes all Pets and terminates the Companion.
- [ ] One tray menu controls all Pet instances; v1 has no per-Pet tray settings.
- [ ] A focused macOS smoke test verifies transparency, always-on-top behavior, click-through, Arrange mode, Hide/Show, Reduced motion, and Quit with real Electron windows.
