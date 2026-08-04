# 01 — Enforce Conventional Commits locally

**What to build:** Set up commitlint and Husky so contributors and coding agents get immediate feedback when a commit message does not follow Conventional Commits. Use the current npm releases and the official Husky v9 macOS setup.

**Blocked by:** None — can start immediately after the repository has been initialized with Git.

**Status:** ready-for-agent

- [ ] The npm project installs the current compatible releases of `@commitlint/cli`, `@commitlint/config-conventional`, and `husky` as development dependencies and records their resolved versions in the lockfile.
- [ ] Commitlint uses `commitlint.config.mjs`, extends `@commitlint/config-conventional`, and loads without requiring the application package to choose CommonJS or ESM.
- [ ] Husky is initialized with `npx husky init`, and the resulting `prepare` script reinstalls hooks after `npm install`.
- [ ] A Husky `commit-msg` hook passes the commit message file to `commitlint --edit` using the current Husky v9 syntax documented for macOS.
- [ ] The placeholder `pre-commit` hook created by `npx husky init` is removed; only the required `commit-msg` hook remains.
- [ ] A valid message such as `feat: spawn an idle pet` succeeds.
- [ ] An invalid message such as `added pet stuff` fails before Git creates the commit and reports the violated commitlint rule.
- [ ] The hook works in a fresh macOS checkout after `npm install` without global commitlint or Husky installations.
- [ ] Contributor and agent guidance states that commits must follow Conventional Commits.
- [ ] No staged-file linter, formatter hook, commit prompt, or CI commitlint workflow is added in this ticket.
