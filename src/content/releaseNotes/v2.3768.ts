import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3768',
  date: '2026-09-23',
  title: 'Lien desk: the Timeline tab — every job on the grid, and Print the grid for counsel',
  kind: 'feature',
  highlights: [
    'A third tab on the Lien desk lists every billed job with money open and a lien month — not just this month’s notices — one row each: the job, its GC and property kind, the dollars, its timeline in miniature, and the one next step with its days. Rows sort by the next date, so the top of the list is what the office does first.',
    'A GC picker turns the list into that GC’s book; Show switches between Something due (inside 30 days, plus any closed window nobody has noted) and All (the tail — filed liens whose year is running — and the ones that are gone). A row opens the job on whichever pane its next step belongs to; a job the desk does not list yet opens its Lien window.',
    'Print the grid hands counsel the memo’s table, one row per job, letter landscape: address, owner of record, kind and homestead, last on site, unpaid months and dollars, each month’s § 53.056 date, the affidavit date, and blanks — payment bond, paid out to the GC, the ten percent reserved, the contract’s completion — where the app does not hold the fact yet, with a footnote saying so.',
    'Nothing is typed and nothing new is stored: the tab reads the same rules and records the desk already uses, over the whole book instead of the next 30 days.',
  ],
}

export default note
