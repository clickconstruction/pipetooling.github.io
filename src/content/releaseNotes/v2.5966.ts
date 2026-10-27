import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5966',
  date: '2026-10-27',
  title: 'A batch keeps going past a held row and names it',
  kind: 'feature',
  highlights: [
    'Draft payroll\'s Generate 6 reports, HCP reconcile\'s Apply 12 · 3 invoices, 5 dates, 4 links, the RFI paste\'s Import 6 as drafts and Adopt bids now try every row. Each one that did not go through stays on screen with the reason and a way to try it again.',
    'Schedule → Share reads Send to 3 · 1 has no email and sends to the rest. The person with no email stays picked with Add an email, which opens their desk. Scheduling a crew on a job adds the people who are free and holds the one whose day overlaps, with a link to that job.',
    'The supply house Ask sheet saves the answers it can and holds only a balance marked in red. They promised writes the date on every bill and names the bill it did not reach. The user review ledger names each transaction that did not update, with Try again.',
    'Banking → Rules reads Apply rules · 37 matches before you press it, and the four Unpin all buttons on Settings → Dashboard say how many people have the pin.',
  ],
}

export default note
