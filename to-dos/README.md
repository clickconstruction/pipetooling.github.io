# To-dos

Projects that were designed, discussed, or partly built but cannot be finished right away. Any editor — a person or an agent session — can pick one up cold.

Each to-do is one folder or file here. It must leave enough behind that the next session does not have to re-derive the decision:

- **The ask, in the owner's words** — what was wanted and why.
- **The decision** — which option was picked, what was rejected, and any open questions.
- **The mock-up or spec** — kept here (an `.html` next to the `.md`), not only on a chat link.
- **Where it plugs in** — the files, kernels, tables, and RPCs already involved, with what exists versus what is new.
- **The plan** — an ordered PR train, smallest shippable first, with what each PR touches.
- **How to verify** — the live-test recipe, test data or dummy accounts, and any gotchas hit along the way.
- **State** — `Status:` line at the top (`not started` · `in progress` · `blocked on …` · `shipped, delete me`).

When you pick one up: put your branch name on the `Status:` line, drop a session card in `.claude/sessions/active/` (see [`docs/SESSIONS.md`](../docs/SESSIONS.md)), and follow the repo's usual conventions — claim a version with `npm run claim`, ship a release note and a `docs/recent-features/` fragment per PR, guides with features. When it ships, delete the to-do and let the release notes and docs carry the record.

Index:

| To-do | Status | Summary |
|---|---|---|
| [`work-orders-one-row-spine.md`](./work-orders-one-row-spine.md) | not started | Work Orders and Sub Labor share one row, with the sub portal's progress rail on it; two derivation bugs to fix first. |
