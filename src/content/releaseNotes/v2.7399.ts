import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7399',
  date: '2026-11-15',
  title: 'A subcontractor’s job window shows Your pay',
  kind: 'feature',
  highlights: [
    'On a phone, a subcontractor’s job window has a new row, Your pay, under What’s happening.',
    'It shows what is open on their own work on that job, with the agreed price and what has been paid under it, like “$2,100.00 open · $4,200.00 agreed · $2,100.00 paid”.',
    'The last line says when it pays: the day the office set, a hold and its reason, or the stage the work is at. A job paid in full says so, with the day of the last payment.',
    'The numbers are the same ones on the sub’s portal, and Open your portal takes them there. A job with no sheet in their name says so.',
  ],
}

export default note
