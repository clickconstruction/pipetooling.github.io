# Migration doc fragments

One file per migration, named after the migration file with a `.md` extension
(`20260820220000_example.sql` → `20260820220000_example.md`). This replaces
appending to `docs/MIGRATIONS.md` (frozen 2026-08-20) — per-migration files
mean parallel PRs never conflict on the migrations doc.

Format:

```markdown
# 20260820220000_example.sql (YYYY-MM-DD, v2.NNNN)

<What the migration does, which feature/PR it shipped with, and any
apply-order coordination notes (deploy client first, etc.).>
```

The frozen `docs/MIGRATIONS.md` still holds the full pre-cutover history plus
the best-practices and rollback sections — those sections stay maintained
there; only the per-migration changelog moved here.
