<!-- PR template — keep it tight. -->

## What & why

<!-- One or two sentences. Link the issue / feature if any. -->

## Type

- [ ] New tests (feature)
- [ ] Test fix / flake
- [ ] Infrastructure (fixtures, helpers, POM, CI)
- [ ] Tooling (perf, security, observability)
- [ ] Docs

## Checklist

- [ ] `npm run compile` and `npm run lint` pass
- [ ] New/changed tests pass locally (`npm test` / relevant `test:*`)
- [ ] No explicit timeouts — auto-waits only (atomic, isolated tests)
- [ ] Only skipped tests with a documented **app** bug (`docs/bug-reports/`), not test-side issues
- [ ] Visual snapshots committed if `@visual` changed
- [ ] Followed the **one-file-per-feature-per-layer** structure

## Notes for reviewer

<!-- Anything non-obvious: new app bug found, threshold tuned, etc. -->
