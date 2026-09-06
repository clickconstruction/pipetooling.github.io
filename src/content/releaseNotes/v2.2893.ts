import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2893',
  date: '2026-09-05',
  title: 'Rosters, pickers and lenses show active people only',
  kind: 'fix',
  highlights: [
    'Crew pickers, the Person rail, the / quick sheet, checklist assignee lists, the Review deck and the "Team reviews due" nag now share one active-people list — digital twins and archived accounts no longer appear, and the test fixture shows only to dev viewers.',
    'Followup → By builder no longer counts the twin fleet\'s bids inside real builder groups; the Calendar\'s "Bid due" entries and the New Job → Import picker hide twin backtest copies of real bids.',
    'A supply house can be marked "Not a supplier we quote from" on its card — insurers, rental yards and payee-only vendors stay on Materials but drop out of the RFQ and quote pickers.',
  ],
}

export default note
