# Architecture Decision Records (ADR)

Short, immutable records of the significant decisions behind this test platform.
Each ADR captures the context, the decision, and its consequences so the _why_
survives long after the _what_.

Format: [Michael Nygard's ADR template](https://github.com/joelparkerhenderson/architecture-decision-record).

| #                                              | Title                           | Status   |
| ---------------------------------------------- | ------------------------------- | -------- |
| [0001](0001-one-file-per-feature-per-layer.md) | One file per feature, per layer | Accepted |
| [0002](0002-black-box-only.md)                 | Black-box only (REGLA #1)       | Accepted |
| [0003](0003-sequential-ci-gates.md)            | Sequential CI gates             | Accepted |
| [0004](0004-sql-data-integrity-layer.md)       | SQL data-integrity layer        | Accepted |

To add one: copy the structure of an existing ADR, bump the number, never edit a
decided ADR — supersede it with a new one instead.
