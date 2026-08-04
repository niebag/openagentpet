# Domain docs

How engineering skills consume this repository's domain documentation.

## Before exploring

Read the root `CONTEXT.md` and the ADRs relevant to the work in `docs/adr/`. If a root `CONTEXT-MAP.md` exists later, read it first and then the relevant context files it lists.

If one of these files does not exist, proceed without comment. The domain-modeling flow creates documentation only when a term or decision is resolved.

## Layout

This is a single-context repository:

```text
/
├── CONTEXT.md
├── docs/adr/
└── src/
```

## Use glossary terms

Use terms defined in `CONTEXT.md` in issue titles, proposals, hypotheses, and tests. Do not replace terms the glossary explicitly avoids with synonyms.

If a required concept is absent from the glossary, either reconsider the language or record the gap for `/domain-modeling`.

## Flag ADR conflicts

Surface any contradiction with an existing ADR rather than silently overriding it.
