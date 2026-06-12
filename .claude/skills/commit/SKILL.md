---
name: commit
description: Smart git commit. Analyzes the diff, runs gts lint, and creates a Conventional Commits message. Asks for confirmation before committing.
disable-model-invocation: false
---

Create a smart git commit for staged or unstaged changes.

## Instructions

1. Run `git status` and `git diff` to understand what changed.

2. Run `npx gts lint` — if there are errors, fix them with `npx gts fix` before continuing.

3. Analyze the changes and draft a commit message following **Conventional Commits**:
   - Format: `type(scope): short description`
   - Types: `feat`, `fix`, `test`, `chore`, `refactor`, `style`, `docs`
   - Scope: file or feature area (e.g. `login`, `config`, `ci`)
   - Examples:
     - `test(login): add authentication flow tests`
     - `fix(config): correct tsconfig include paths`
     - `chore(deps): add gts and husky`

4. Show the user the proposed commit message and the list of files to be staged. Ask for confirmation.

5. On confirmation: stage the files and commit.

## Example invocation

`/commit`
`/commit only the test files`
