# Pet packs

OpenAgentPet looks for custom Pet packs in:

```text
~/Library/Application Support/OpenAgentPet/Pet Packs/
```

Create one subdirectory per pack. Each pack needs a `manifest.json` and five
different transparent GIF files, one for every Activity state:

```json
{
  "name": "My Pet",
  "assets": {
    "Idle": "idle.gif",
    "Thinking": "thinking.gif",
    "Researching": "researching.gif",
    "Working": "working.gif",
    "Needs input": "needs-input.gif"
  }
}
```

Asset paths must be relative to the pack directory and cannot point outside it.
OpenAgentPet checks that all five files exist, use the GIF format, contain
transparent frames, and can be decoded before it activates the pack.

Run the interactive selector to choose the built-in default or a valid custom
pack:

```sh
openagentpet pack use
```

Pass a pack directory to select it without a prompt:

```sh
openagentpet pack use "/path/to/My Pet"
```

A successful selection updates existing Pets and is saved for future Pets. If
validation fails, OpenAgentPet prints the problem and keeps the current pack.
