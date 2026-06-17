# Contributing & Git conventions

The single source of truth for **how we name branches, write commits, and open
PRs** in this repo. These conventions are **not optional** — `semantic-release`
parses every commit on `master` to decide the next version and CHANGELOG, so a
malformed commit silently breaks the release pipeline.

> TL;DR — **branch:** `type/short-kebab-desc` · **commit & PR title:**
> [Conventional Commits](https://www.conventionalcommits.org/) (`type(scope): subject`)
> · **merge:** squash (the PR title becomes the commit). When in doubt, run the
> [`/commit`](.claude/skills/commit/SKILL.md) skill — it builds a compliant message for you.

---

## 1. Branch naming

```
<type>/<short-kebab-description>
```

- `<type>` is one of the commit types below (most common: `feat`, `fix`, `test`,
  `docs`, `chore`, `ci`, `refactor`).
- `<short-kebab-description>` — 2–5 words, lowercase, hyphen-separated, no issue
  numbers in the slug (link the issue in the PR instead).

**Examples**

| Branch                         | For                        |
| ------------------------------ | -------------------------- |
| `test/bank-accounts`           | new tests for a feature    |
| `fix/signin-remember-me-flake` | fixing a flaky/broken test |
| `docs/ci-conventions`          | documentation              |
| `ci/cache-playwright-browsers` | pipeline/workflow change   |
| `chore/bump-playwright-1-61`   | deps / maintenance         |

- Never commit directly to `master`. Always branch.
- Delete the branch after the PR merges (local + remote).
- `dependabot/*` branches are created automatically — leave them alone.

### Granularity — one branch = one reviewable PR

The branch maps to a **coherent PR**, not mechanically to a test type:

- **One feature-task → one branch**, even if it spans several test types — each
  type is a separate Conventional Commit inside it. E.g. full coverage for `X`:
  `test/x-coverage` with commits `test(ui): …`, `test(api): …`, `test(perf): …`
  → one PR `test: add full coverage for X`.
- **Separate asks / unrelated features → separate branches & PRs.** E.g. Playwright
  for `X` and a k6 scenario for `Y` are two branches (`test/x-ui`, `perf/y-k6`).

Default: a branch per feature-task; split into multiple PRs only when the work is
genuinely independent or a single PR would grow too large to review. When it's
ambiguous, ask before branching.

## 2. Commit messages — Conventional Commits

```
<type>(<scope>): <subject>

[optional body — what & why, wrap at ~72 cols]

[optional footer — BREAKING CHANGE:, Refs #123, Co-Authored-By:]
```

### Types (and their release impact)

| Type       | Use for                                          | Release (`semantic-release`) |
| ---------- | ------------------------------------------------ | ---------------------------- |
| `feat`     | a new capability (new test feature, new tooling) | **minor** (`x.+1.0`)         |
| `fix`      | a bug fix (test fix, CI fix, config fix)         | **patch** (`x.x.+1`)         |
| `perf`     | a performance improvement                        | **patch**                    |
| `docs`     | documentation only                               | none                         |
| `test`     | adding/adjusting tests (the bulk of this repo)   | none                         |
| `refactor` | restructuring without behavior change            | none                         |
| `ci`       | CI/CD workflows, actions, pipeline               | none                         |
| `chore`    | deps, tooling, housekeeping, releases            | none                         |
| `style`    | formatting only (no logic)                       | none                         |

A **breaking change** = append `!` after the type/scope **and** a
`BREAKING CHANGE:` footer → triggers a **major** bump regardless of type.

### Scope (optional but encouraged)

The area touched. Scopes actually in use here: `api`, `ui`, `db`, `ci`, `deps`,
`deps-dev`, `dependabot`, `release`, `security`, `observability`, `bugs`,
`backlog`, `qa`, `tooling`, `contract`, `chaos`, `staging`, and feature names
(`signin`, `signup`, `home`, `transaction`).

### Rules

- **Subject:** imperative mood, lowercase, **no trailing period**, ≤ ~72 chars.
  - ✅ `test(api): assert fixed signup behavior; mark 7 app bugs resolved`
  - ❌ `Fixed the signup tests.` / `update stuff`
- Reference a bug from the manifest when relevant (`BUG-…`), and the GitHub issue
  in the footer (`Refs #12`).
- Commits authored with AI assistance end with the trailer:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Release commits are made **by the bot** and carry `[skip ci]` — never hand-write
  a `chore(release):` commit.

## 3. Pull Requests

- **Title = a valid Conventional Commit** (`type(scope): subject`). Because we
  **squash-merge**, the PR title becomes the single commit on `master` that
  `semantic-release` reads. A wrong title = a wrong (or missing) release.
- Fill in the [PR template](.github/pull_request_template.md): _what & why_,
  _type_, and the checklist (compile + lint pass, tests pass, no explicit
  timeouts, skips only for documented app bugs, one-file-per-feature-per-layer).
- Keep PRs focused and small where possible. One logical change per PR.
- Link the issue/feature; call out anything non-obvious (new app bug found,
  threshold tuned) in _Notes for reviewer_.

## 4. Merging & CI gates

- The PR must be **green** before merge. The gated pipeline
  (`quality → contract → api → db → ui → performance → zap`) runs on every PR;
  a broken gate blocks the merge. See
  [docs/adr/0003-sequential-ci-gates.md](docs/adr/0003-sequential-ci-gates.md).
- **Squash-merge** to `master` (one clean Conventional Commit per PR). Do not
  create merge commits on `master`.
- After merge, `semantic-release` (via `release.yml`) versions, tags, updates
  `CHANGELOG.md`, and publishes the GitHub Release — **automatically**. Do not tag
  or edit versions by hand.
- Delete the merged branch.

## 5. Local guardrails

A Husky **pre-commit** hook runs `tsc --noEmit` + `lint-staged` (GTS fix/lint on
`*.ts`/`*.js`, Prettier on `*.json`/`*.md`). If it fails, the commit is rejected —
fix the issue rather than bypassing with `--no-verify`.

```bash
npm run compile   # tsc
npm run lint      # gts lint
npm run fix       # gts auto-fix
```

---

> **For AI agents (Claude Code):** this file is referenced from `CLAUDE.md` and
> must be respected on every branch/commit/PR you create. Prefer the `/commit`
> skill to author messages.
