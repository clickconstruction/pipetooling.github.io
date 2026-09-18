import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3579',
  date: '2026-09-17',
  title: 'Payroll: backfill past payments from the Cash App export',
  kind: 'infra',
  highlights: [
    'A command-line backfill reads the Cash App export and the Mercury payroll feed, matches each send to the payment it paid, and writes the link — correcting a recorded amount to the send when the two are within $5, splitting a payment that merged several sends, and filing expenses and pre-record money to their lanes.',
    'It plans first and writes only when told to, through the same functions the app uses, so a re-run never records a send twice.',
    'Nothing changes on screen in this release.',
  ],
}

export default note
