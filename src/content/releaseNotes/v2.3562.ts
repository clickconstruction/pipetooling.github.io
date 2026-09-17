import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3562',
  date: '2026-09-17',
  title: 'Sub sheets: move a payment to the right sheet, or remove it with a reason',
  kind: 'feature',
  highlights: [
    'Every payment and backcharge row on a sub sheet now carries Edit, Move… and Remove (Edit and a ⋯ menu on a phone). A payment recorded on the wrong job moves to the right sheet in one step — amount, date, memo and portal visibility go with it, nothing is retyped.',
    'Move lists the same sub\'s other sheets first and shows what both sheets will read before and after, down to "paid in full".',
    'Remove asks why — Duplicate entry, Wrong amount, Something else, or Wrong job, which opens Move instead — and can be undone from the sheet for 30 days.',
    'Both sheets keep a grey trace line saying what happened, who did it and why, so a balance that jumped explains itself.',
  ],
}

export default note
