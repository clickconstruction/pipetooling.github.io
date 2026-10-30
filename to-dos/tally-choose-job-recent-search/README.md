---
name: "Job Parts Tally: the Choose job sheet finds a job and leads with the jobs you were on"
number: 216
group: ready
status: asked 2026-10-29 from the owner's phone · mocked up 2026-10-29 (three drafts, Draft A picked on the second pass) · awaiting the owner's yes
summary: >
  The Choose job sheet on the tally lists every job the viewer can see, newest number first,
  four hundred rows deep, with no way to search and nothing of the viewer's own day in it.
  The sheet gains a search field at the top (the app's job search: number with or without its
  letter, name, address, customer) and a Recent section under it with the last three jobs the
  viewer clocked in on, newest first, each saying when, with Show N more unfolding to the last
  ten; All jobs follows under its own heading, and typing narrows every section at once. One
  component replaces the two copies (Materials estimate, On site).
next: the owner's yes on Draft A and his three answers (where Recent comes from, the when-line, whether All jobs repeats a recent job); then one PR.
size: S
blocker: None.
opinion: build Draft A as drawn; the when-line is the one thing that makes the section explain itself
mockup: mockup.html (Drafts A, B, C; the second pass; the three questions)
---

# Job Parts Tally: the Choose job sheet finds a job and leads with the jobs you were on

## The ask

> In Job Parts Tally, the Choose job sheet that links a purchase to a job is one long list of every job in no useful order. Two things are missing: a way to search, and the jobs you were on recently, at least the last three, with a way to expand further. — owner, 2026-10-29, from his phone

## The decision (pending his yes)

- **Draft A** of `mockup.html`: search on top, not focused on open; **Recent** (three, newest first, each with when); **Show 7 more** to ten; **All jobs** under its own heading with its count; typing narrows every section; nothing matching draws the filter empty state.
- **Recent** reads the viewer's own clock-ins (`clock_sessions`, not rejected or revoked), each job once, newest first; with none, the jobs the viewer's card purchases were last sorted to, and the row says so; with neither, no section.
- **One sheet for both tabs** (Materials estimate's picker in `JobTally.tsx`, On site's `Sheet` picker in `TallyOnSiteTab.tsx`).

## Where it plugs in

| Piece | Exists | New |
|---|---|---|
| The sheet | the two pickers above | `TallyChooseJobSheet`, both callers |
| Search | `barMatchesSearch` / `forecastJobMatchesSearch` over the ledger prefix map | the tally's job rows carry `customer_name` and `service_type_id` |
| Recent | `clock_sessions` as `fetchSortModeDayJobs` reads it; the viewer's sorted purchases | `lib/tally/recentJobs.ts`: the pure order and the when-words, a small reader |
| Empty | `EmptyState` + `emptyWords({ kind: 'filter' })` | — |
| Guide | *sort my card purchases to jobs* | a section on finding the job and your recent jobs |
