# Bind Pets to Claude Code sessions

Each `/openagentpet:spawn` creates one Pet instance bound to the invoking Claude Code session, and `/openagentpet:despawn` removes that instance early. Spawn is idempotent per session. The Pet is also removed automatically when its session ends. This deliberately permits several Pets at once instead of a single global companion, so parallel sessions remain separately visible without leaving orphaned Pets behind.
