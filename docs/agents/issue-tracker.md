# Issue tracker: GitHub

Issues and PRDs for this repository live in GitHub Issues. Use the `gh` CLI for all operations.

## Conventions

- **Create an issue:** `gh issue create --title "..." --body "..."`. Use a heredoc for multiline bodies.
- **Read an issue:** `gh issue view <number> --comments`. Fetch labels and filter comments with `jq` when needed.
- **List issues:** `gh issue list --state open --json number,title,body,labels,comments` with the appropriate `--label` and `--state` filters.
- **Comment:** `gh issue comment <number> --body "..."`.
- **Apply or remove labels:** `gh issue edit <number> --add-label "..."` or `gh issue edit <number> --remove-label "..."`.
- **Close an issue:** `gh issue close <number> --comment "..."`.

Run these commands from the repository so `gh` can infer the remote.

## Pull requests as a triage surface

**PRs as a request surface: no.** Set this to `yes` if external pull requests should enter the triage queue.

When enabled, use the equivalent `gh pr` commands. Only triage pull requests whose author association is `CONTRIBUTOR`, `FIRST_TIME_CONTRIBUTOR`, or `NONE`.

GitHub shares one number sequence between issues and pull requests. Resolve an ambiguous reference with `gh pr view <number>` and fall back to `gh issue view <number>`.

## Skill operations

- **Publish to the issue tracker:** create a GitHub issue.
- **Fetch the relevant ticket:** run `gh issue view <number> --comments`.

## Wayfinding operations

`/wayfinder` uses one map issue with child issues:

- **Map:** create one issue with the `wayfinder:map` label. Keep Notes, Decisions so far, and Fog in its body.
- **Child ticket:** link an issue to the map as a GitHub sub-issue. Use a task-list link when sub-issues are unavailable. Apply a `wayfinder:<type>` label using `research`, `prototype`, `grilling`, or `task`.
- **Blocking:** use GitHub's native issue dependencies. Add an edge with `gh api --method POST repos/<owner>/<repo>/issues/<child>/dependencies/blocked_by -F issue_id=<blocker-db-id>`, where `<blocker-db-id>` comes from `gh api repos/<owner>/<repo>/issues/<number> --jq .id`. If dependencies are unavailable, add `Blocked by: #<number>` to the child issue.
- **Frontier:** list the map's open children, drop assigned issues and issues with an open blocker, then take the first issue in map order.
- **Claim:** run `gh issue edit <number> --add-assignee @me` as the session's first write.
- **Resolve:** comment with the answer, close the child issue, then add a context pointer to the map's Decisions so far.
