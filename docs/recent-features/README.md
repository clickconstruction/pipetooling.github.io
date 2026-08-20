# Recent-features fragments

One file per shipped PR, named `v2.NNNN.md` with the version claimed via
`npm run claim`. This replaces prepending to `docs/RECENT_FEATURES.md` (frozen
2026-08-20) — per-version files mean parallel PRs never conflict on the
changelog.

Format:

```markdown
# v2.NNNN — <short title> (<YYYY-MM-DD>)

<The entry body — same depth as the old "## Latest Updates" entries: what
changed, the key files as relative links, migration/edge-function notes,
"Client-only — no migration." when true.>
```

Rules (CI-enforced by `src/lib/releaseNotes.test.ts`):

- The first line must be a `# v2.NNNN — …` heading matching the filename.
- Every fragment needs a matching release-note fragment
  `src/content/releaseNotes/v2.NNNN.ts` (and vice versa), same version.
- Never reuse a version documented in the frozen archive or another fragment.

Finding history: `grep -rn <term> docs/RECENT_FEATURES.md docs/recent-features/`
— the archive holds everything through the cutover, fragments everything after.
