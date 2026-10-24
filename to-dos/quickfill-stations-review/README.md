---
name: "Quickfill stations review: the four picks of 2026-10-24 and how to resume each build"
number: 160
group: close
status: saved 2026-10-24 while the four builds ran in four sessions; each build's own to-do (#156 to #159) carries its live status
summary: >
  On 2026-10-24 the owner walked Quickfill's stations one by one and asked for a redraw of
  four: the Mark history window, the Texts station, the Physical inbox and the Email station.
  Each got a proposal with a mock-up (#156 to #159, all merged), and he answered all four at
  once: "I like your suggestions, build it all." The builds started the same afternoon in
  four sessions. This entry is the save point he asked for in case a session runs out before
  its train lands: the pick for each, the train each follows, and the steps to resume from
  main. It changes no screen.
next: As each build lands, its own to-do moves to built; when all four are built, retire this entry.
size: XS (a record)
blocker: none
ver: proposed
mockup: not required — a record of four builds, no screen of its own
opinion: keep this until the four to-dos read built; a resumed session starts from each to-do's Where it plugs in and the PRs that carry its number, never from memory
---

# Quickfill stations review: the four picks of 2026-10-24 and how to resume (#160)

## The ask

The owner, 2026-10-24, after four proposals came back on the same afternoon: "I like your
suggestions, build it all." Then, a few minutes later: "I think that we are gonna run out of
tokens while building this. Can you help me save something to the punch list?" This is that
save.

## The four picks

| To-do | The station | The pick | The train |
| --- | --- | --- | --- |
| #156 `quickfill-mark-history` | Every station's **Mark history** window | **A**: the checklist ledger's tiles, one cell a workday for eight weeks with the open count in it, who and when under it, on a station with boxes a band of the boxes' own ticks, the rows kept for the detail, the Note column only when a note exists. Nothing new on the server. | One build PR (its README → Where it plugs in, The plan). |
| #157 `quickfill-texts-station` | **Texts** | **A**: the day's text ledger read from Messages — texts that need a reply oldest first with the thread door and Reply, the texts we owe with Text now, texts not delivered with Resend or Call, the texts that went out today with their delivered marks, a small Anything else? note, a clean day one press. Only rows the Messages page already reads. | One build PR, no migration (its README → Where it plugs in). |
| #158 `quickfill-physical-inbox` | **Physical inbox** | **A**: the clarify deck in GTD's shape — each paper typed once with the day it came, a press per item (Trash · File it · Do it now · Make a task · Waiting for · Someday), an item leaving the moment it is clarified, the count the unclarified paper with its age, the recurring kinds (tolls, insurance cards, certificates, renewals) offered as recurring checklist routines after a one-time sort of the seven lingering words. The owner did not say where a decided paper lands by default; the building session takes the README's recommended default and says so in its fragment, a one-line change if he wants another. | The README's plan (Where it plugs in, The plan); a migration if the deck needs a table. |
| #159 `quickfill-email-station` | **Email** | **B**: live labels per box and per person over the delegation the bids@ reader already holds, metadata only (subjects, senders, dates, ages; never bodies), each person's named labels with the live count, the age of the oldest thread, what moved since yesterday, the threads that have sat past the mark with a door into Gmail, the privacy stance written on the station, the app's own list of what it reads as the control, the history as a trend of items and ages. | Five PRs (S · M · S · M · S; its README → The PR train, B over the delegation): one migration, one new edge function, and **one Google admin step for the metadata scope**, at which the session stops and writes the owner the exact steps. No real mailbox beyond bids@ is read until he has done it and said so. |

The build sessions were told the same four rules: cut from fresh main after the proposal PR
merged, keep each PR to the files it needs, rebase before every push (all four may touch
`src/pages/Quickfill.tsx` and `docs/QUICKFILL_ARCHITECTURE.md`), and when a conflict is only a
sibling's squash take main's lines and re-apply their own. Each PR follows CLAUDE.md: a claimed
version, one release note and one fragment, kernels first with tests, a render smoke, the
Quickfill map and the Glossary amended, the guide in plain words, the to-do's status set to
built as it lands.

## What counts as the spec

Each to-do's folder on main holds the drawing and the plan; this entry holds no drawing of its
own. For a builder who was not there, the spec of each station is three things read together:

1. **The drawing**: `to-dos/<folder>/mockup.html`, the tab or panel marked *the pick* (A, A, A
   and B above), with its phone and dark variants. It is the owner's picture; build what it shows.
2. **The decisions**: the README's *Decisions for the owner* list, every item answered with its
   *Recommended* line, since the owner's words were "I like your suggestions, build it all" and
   nothing else. A builder who wants a different answer asks him; none is a guess.
3. **The plan**: the README's *Where it plugs in* and *The plan* or *The PR train* — the files,
   the kernels, the tables, the PR order and the size of each.

What the folders do not hold: screenshots of the stations as they were on 2026-10-24. The
mock-ups draw today's station beside the options where it matters, and the fragments of the
build PRs carry before-and-after pictures as they land.

## How to resume a build that stopped

1. Read that to-do's `README.md`: its `status:` line says how far it got, *Where it plugs in*
   names the files, and *The plan* or *The PR train* names the PRs in order.
2. Find what landed: `gh pr list --state all --search "punch list #15N"` (the number is in every
   PR title), and `git log --oneline origin/main --grep="#15N"`. A merged PR's fragment in
   `docs/recent-features/v2.NNNN.md` says what it built and what it left.
3. Find what is in flight: an open PR on a `claude/*` branch carries the unfinished work; check
   it out rather than starting over. `npm run sessions` lists the live session cards in the main
   checkout's `.claude/sessions/active/`, and the shared hand-over notes beside them say where a
   session stopped.
4. Claim the next version with `npm run claim`, never by counting, and carry on from the next
   PR in the train.
5. For #159, if the stop is the Google admin step, the step is written in the to-do and the
   last fragment; nothing resumes until the owner has done it.

## Also open from the same review

- The Roller view is Quickfill's default since 2026-10-24 (PR #6093).
- Percent complete's card bar is its slider (v2.5805, to-do #154, folder to delete once seen live).
- The Subs board (to-do #153, built as four PRs on 2026-10-24) left two things for a dev: the ZZ
  Test Sprinkler Co the walk put on the bench, and the run's text press needs a Messages thread
  a sub does not have yet.
- Call in Quo or from my phone (v2.5803) waits on the owner's try on a real phone with the Quo app.
- Two Mercury accounts are still unnamed in the Account nicknames window (v2.5806).

## Where it stands

Saved 2026-10-24 with the four builds running. Nothing here is a build; the four to-dos hold
their own status, and this entry retires when all four read built.
