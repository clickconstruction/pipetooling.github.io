import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3437',
  date: '2026-09-14',
  title: 'Lien notices carry the unpaid invoice',
  kind: 'feature',
  highlights: [
    'The § 53.056 notice now goes out with the job’s unpaid invoice behind it — Texas lets the notice include the invoice, and an owner who sees the bill can withhold the right amount from the GC.',
    'On the Lien window’s notice tab, “Enclose the invoice” is on by default: it prints after the notice, rides the emailed PDF stamped INVOICE, and the notice’s reference strip says it is enclosed.',
    'The Lien desk’s run packet does the same for every notice it prints or emails.',
  ],
}

export default note
