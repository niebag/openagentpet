---
description: Show an Idle Pet for this local Claude Code session
disable-model-invocation: true
---

Start the Pet for this local Claude Code session.

```!
if [ "${CLAUDE_CODE_REMOTE:-}" = "true" ]; then
  echo "OpenAgentPet only supports local Claude Code sessions."
  exit 1
fi
openagentpet spawn --session-id "${CLAUDE_SESSION_ID}"
```

If the command fails, show its error and do not retry it.
