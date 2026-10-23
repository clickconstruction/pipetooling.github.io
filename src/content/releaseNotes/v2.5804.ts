import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5804',
  date: '2026-10-23',
  title: 'Banking Approvals: every card says the day the charge was made',
  kind: 'feature',
  highlights: [
    'On Banking → Accounting → Approvals, each card now reads the day of the charge to the right of its Card line: Tuesday · 3 days ago (10/20/26), Today (10/23/26), Yesterday (10/22/26).',
    'The day is the swipe, the moment Mercury first saw the charge, so a charge still pending at the bank has a day before it posts. The Posted line stays as it was.',
    'Days are counted in the company’s own time zone, so an evening charge keeps its own day.',
  ],
}

export default note
