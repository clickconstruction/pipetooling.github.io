# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo.

## DB migrations — the one rule that prevents drift

**Apply migrations ONLY with `supabase db push`, and only after the migration file is on `main` (or in the PR merging right now).**

Never apply DDL via the Supabase MCP `apply_migration`, `execute_sql`, or the dashboard SQL editor:
- `apply_migration` mints a **server-timestamp ledger version** that will never match the repo's clean-numbered filename → renumber drift, and `db push` starts refusing.
- `execute_sql` / SQL editor apply the change with **no ledger row at all** → the migration looks pending forever.
- Applying from an unmerged branch strands the file if the branch dies → orphan ledger rows.

All three happened; reconciling them took a full ledger rewrite (2026-07-04, backup at `supabase_migrations._schema_migrations_backup_20260704`).

If an emergency ever forces MCP `apply_migration`: immediately rename the new ledger row's `version`/`name` to match the repo filename in the same session.

Also:
- **Number new migrations from `origin/main`'s latest file** (`git ls-tree origin/main supabase/migrations/ | tail`), not from your branch — two parallel branches once minted the same version.
- Check alignment any time with `npm run check:migration-drift` (CI runs it on main pushes touching migrations + a strict daily cron: `.github/workflows/migration-drift.yml`).

## Deploy model (three separate tracks)

CI (`deploy.yml`) only typechecks/lints/tests and deploys the **client** to GitHub Pages. The other two tracks are manual:

1. **DB migrations** — `supabase db push` (see rule above). Coordinate ordering: deploy the client first when a migration changes behavior the old client would misread.
2. **Edge functions** — `supabase functions deploy <name>` (or MCP `deploy_edge_function`). Editing `supabase/functions/*` does nothing until deployed. Check with `npm run check:edge-drift`. `create-user` has `verify_jwt = false` in `config.toml` — preserve it on redeploys.

The linked prod project is `yewfzhbofbbyvkvtaatw` ("plumbing-stage-manager"). There is no staging environment — migrations hit prod, so write them idempotent (`IF NOT EXISTS` / `CREATE OR REPLACE`) and additive when possible.

## Working conventions

- Ship small: one change → PR → auto-merge (`gh pr merge --auto --squash`). Never `git add -A` — parallel sessions leave WIP in the tree; stage specific files.
- Extract logic into pure `.ts` kernels with unit tests (`npm test`); there is no render-test harness in this repo.
- **Help guides ship with features**: any PR that adds or changes a user-facing flow must add/update the matching guide in `src/content/help/` (frontmatter: title/category/roles/keywords; slug = filename; headings start at `##`). Titles are lowercase completions of "How do I…" (e.g. `title: bill a customer and get paid`). `src/lib/helpGuideContent.test.ts` validates frontmatter + title form in CI. Illustrate every guide with mock-UI tokens — `{{button:<variant>|Label}}`, `{{chip:<variant>|Label}}`, `{{icon:help|gear}}`, `:::example <caption>` … `:::` panels, and optional screen recordings via `{{gif:<file>|caption}}` (files in `public/help/`, lazy-loaded, excluded from the SW precache) (syntax + variants in `src/lib/helpGuideIllustrations.ts`).
- **Release notes ship with features** (v2.944): every feature/fix PR adds an entry to `src/content/releaseNotes.ts` with the **same `v2.NNN`** as its `docs/RECENT_FEATURES.md` entry — short, user-readable (title + 1–4 highlight bullets, no file paths); it renders at Settings → Release notes for all roles. The drift test in `src/lib/releaseNotes.test.ts` fails CI until the newest versions match.
- **Developer docs ship with features too** (they drifted a full week once — 2026-07-12 catch-up, PR #234): every feature/fix PR adds its `docs/RECENT_FEATURES.md` entry (`## Latest Updates (v2.NNN)` above the previous newest, next version number, update the frontmatter `last_updated`); every migration gets a `docs/MIGRATIONS.md` entry; every new/changed edge function gets a `docs/EDGE_FUNCTIONS.md` section (+ TOC line); update `PROJECT_DOCUMENTATION.md` / `GLOSSARY.md` / `ACCESS_CONTROL.md` when a PR renames a surface, adds a tab/section/modal, or changes role permissions.
- **Entry docs stay lean**: `AGENTS.md`, `docs/AI_CONTEXT.md`, and `docs/README.md` are routers, not changelogs — never append per-feature detail (component inventories, version numbers, migration IDs) to them; that detail lives once in `docs/RECENT_FEATURES.md` plus the matching specialist doc. Doc frontmatter carries a single `last_updated` and section *names* only — no line-number hints (they rot instantly).
- Migration files are squash-baselined at `20250101000000_baseline.sql`; pre-baseline history lives in `supabase/archive/migrations-pre-baseline/` (filenames dated "2027" there are typos from spring 2026 — see the note atop `docs/MIGRATIONS.md`).
- **Migrations that CREATE TABLE must end with BOTH `SELECT public.apply_read_only_write_blocks();` and `SELECT public.apply_read_only_stmt_blocks();`** — the first (re)creates the restrictive RLS policies and the second (v2.704) attaches the `read_only_block_stmt` statement trigger that also stops SECURITY DEFINER RPCs. Both block writes from users flagged `users.read_only` (training mode); miss either and the new table is writable by read-only users.
- **Theme tokens, not raw hexes**: the app has light/dark themes (time-of-day + gear-menu override). Use the CSS variables from `src/index.css` (`var(--text-muted)`, `var(--surface)`, `var(--border)`, …) in styles — CI fails on raw neutral hexes (`node scripts/theme-tokenize.mjs --check src`; the same script without `--check` auto-fixes). Saturated action/status colors stay literal. Customer-facing/print surfaces stay light via `data-theme="light"` wrappers (printing auto-pins light).
