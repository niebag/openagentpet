---
description: Remove the Pet for this local Claude Code session
disable-model-invocation: true
---

Remove the Pet for this local Claude Code session.

```!
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  echo "OpenAgentPet only supports local Claude Code sessions."
  exit 1
fi
openagentpet despawn --session-id "${CLAUDE_SESSION_ID}"
```

If the command fails, show its error and do not retry it.

If the command reports an available update, tell the user which versions are
installed and available. Ask whether they want to update. Only after they
confirm, run the exact npm command from the output and report whether it
succeeded. If they decline, do nothing else; the Pet has already despawned.
