import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7440',
  date: '2026-11-16',
  title: 'Subs Ledger: gather old payments typed one per sheet into one (sub labor train)',
  kind: 'feature',
  highlights: [
    'The Subs Ledger has Gather old payments… beside Download CSV. It offers payments of one person, one day and one way of paying as the one check they were.',
    'A group the app is unsure of is held with its reason and left unticked. The button says how many it will gather and how many it leaves.',
    'Gathering changes no amount, date or sheet, and no check mark or bank match. The payments get one number, so a check mark on one covers them all.',
    'Payments matched to different bank lines are refused, since they were not one payment.',
  ],
}

export default note
