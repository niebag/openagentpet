# Issue tracker: Local Markdown

Issues and specs for this repo live as markdown files in `.scratch/`.

## Conventions

- One feature per directory: `.scratch/<feature-slug>/`
- The spec is `.scratch/<feature-slug>/spec.md`
- Implementation issues are one file per ticket at `.scratch/<feature-slug>/issues/<NN>-<slug>.md`, numbered from `01`; never use a single combined tickets file.
- Triage state is recorded as a `Status:` line near the top of each issue file. See `triage-labels.md` for the role strings.
- Comments and conversation history append under a `## Comments` heading.

## When a skill says "publish to the issue tracker"

Create a new file under `.scratch/<feature-slug>/`, creating the directory if needed.

## When a skill says "fetch the relevant ticket"

Read the referenced file. The user normally passes the path or issue number directly.

## Wayfinding operations

Used by `/wayfinder`. The map is one file with one child file per ticket.

- **Map:** `.scratch/<effort>/map.md`, containing Notes, Decisions so far, and Fog.
- **Child ticket:** `.scratch/<effort>/issues/NN-<slug>.md`, numbered from `01`, with the question in the body. A `Type:` line records `research`, `prototype`, `grilling`, or `task`; a `Status:` line records `claimed` or `resolved`.
- **Blocking:** a `Blocked by: NN, NN` line near the top. A ticket is unblocked when every listed file is `resolved`.
- **Frontier:** scan `.scratch/<effort>/issues/` for open, unblocked, unclaimed tickets. First by number wins.
- **Claim:** set `Status: claimed` before any work.
- **Resolve:** append the answer under `## Answer`, set `Status: resolved`, then append a context pointer to Decisions so far in `map.md`.
