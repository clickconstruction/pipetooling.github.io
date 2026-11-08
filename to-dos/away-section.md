---
name: "People → Users: an Away section above Archived for a teammate who left with an Away note on"
number: 283
group: close
status: SHIPPED as v2.6723 — the branch rebased onto main of 2026-11-08 as claude/283-away-section-land-ef934e (PR #7355), armed for auto-merge; typecheck, lint, the kernel, render, release-note, guide and directory suites and the theme, word and press checks green; walked on the dev server as the dev
summary: >
  A teammate who left with an Away note on is archived and can still sign in, to the one screen
  the office wrote. People → Users listed them under Archived as "Archived <the day the office
  pressed the button>" between the people who left for good, with nothing about the day back.
  The branch moves every archived login with a note row into an Away card above Archived, one
  row per person with the roster row folded in: the day they left, the day back with the days
  left (amber on and after the day), Edit the note… and Bring back… or Restore. Archived then
  means sealed and banned. The desk header reads away in place of archived while the note is on.
next: nothing for the builder — the PR merges on green. The live walk on 2026-11-08 read People → Users with the one teammate on sabbatical under Away (1), Left Nov 3, 2026, Back on Thursday, Nov 8, 2029 · 1,096 days · alert on, Edit the note… and Bring back… on her row; Archived (36) under it, Logins (25) and Roster rows (11), with her in neither (one away_notes row on prod, so the same lists read Archived (37) before the split); Edit the note… opened the window on her note; her desk header read Helper · Plumbing · away with the Away chip. Still open: whether the Away card should also sit on the phone's toolbar beside Archived (n), today only in the ⋯ menu — a card of its own if the owner wants it.
ver: v2.6723
size: S (one kernel with tests, the Users tab card, a header chip, three guides, docs; all written)
blocker: none
opinion: finish it as built; the one open question is whether the Away card should also sit on the phone's toolbar beside Archived (n), where today only the ⋯ menu lists it.
mockup: not required — the section is built on the branch; the owner's own screenshot of the Archived list was the ask
---

# People → Users: the Away section

## The ask

The owner, 2026-11-08, after putting the first teammate on a three-year sabbatical through End employment and an Away note, looking at People → Users → Archived (38) → Logins (26), where she sat as *Archived 11/8/2026* with **Bring back…**: "When a user is on sabbatical, technically they can log in to see that screen, so maybe they should not be in the archive section on this page. Maybe we should put them in a sabbatical section with a time to return."

## What the branch holds

Branch `claude/283-away-section-land-ef934e` (the first session's branch rebased onto `origin/main` of 2026-11-08), one commit, shipped as v2.6723 after the first claim lapsed while the branch sat.

- `src/lib/people/awaySection.ts` + `awaySection.test.ts` (11 tests): `splitAwayFromArchived` takes the Archived lists and the `away_notes` rows, moves every archived login with a note into an `AwayRow` with its roster row folded in by `account_user_id`, and leaves the rest under Archived; `awayBackWords` (*Back on Thursday, Nov 8, 2029 · 1,096 days*, *Back today*, *Due back Nov 5, 2026 · 3 days ago*, *No day back set*), `awayLeftWords` (*Left Nov 3, 2026*, else *Archived Nov 8, 2026*), due rows first by the oldest day, then the soonest day back, then no day, ties by name; `door` is `bring_back` when the roster row ended, else `restore`.
- `src/components/people/PeopleUsersTab.tsx`: `loadArchivedLogins` also reads `away_notes` for the archived ids (RLS: the people who may archive read them; anyone else sees Archived unchanged) and `login_attached_at`; the split feeds the Archived lists and their count; an **Away (n)** card above the Archived block with a table (Name, Role, Left, Back, Edit the note… / Bring back… or Restore), the desk's `PersonDeskAwayNoteModal` mounted from the tab, and the phone ⋯ menu's *Away (n)*. The render test has the case.
- `src/components/personDesk/PersonDeskHeader.tsx`: on an archived desk, for a viewer who may archive, reads the note row on every change key and says *· away* with an **Away** chip while a note is on.
- Guides *leave a note for a teammate who is away* (new section *Where they are listed*), *bring back a teammate who left*, *archive and restore user accounts*; `GLOSSARY.md` → *Away note*, `PEOPLE_TABS_ARCHITECTURE.md`, `PROJECT_DOCUMENTATION.md`, `ACCESS_CONTROL.md`, `docs/twins/APP_DIRECTORY.md`; the release note and fragment.

## Decided on the way

- **Away, not Sabbatical**: the app's own word for the feature; a sabbatical is one reason among several for the same state.
- **They leave Archived rather than appear twice**, so each count says what its list is.
- **A note with no day back still lists under Away**, reading *No day back set*.

## What stopped it

The owner paused the session before the typecheck finished and before the live walk. Everything else ran green: `awaySection.test.ts`, `PeopleUsersTab.render.test.tsx`, `PersonDeskDrawer.render.test.tsx`, `PersonDeskAwayNoteModal.render.test.tsx`, `releaseNotes.test.ts`, the five guide suites, eslint on the changed files, the theme, word and press checks.
