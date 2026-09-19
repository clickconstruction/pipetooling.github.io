import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3621',
  date: '2026-09-19',
  title: 'Supply houses: catch a house up in one go — Mark all opened, Flag n invoices',
  kind: 'feature',
  highlights: [
    'On a house\'s Job accounts roster, Mark all N opened… writes an open account row for every amber "bought, no account" job at once, with the same how, rep and note; add each house reference from the row\'s Edit when you have it.',
    'An open row whose invoices are not yet flagged shows Flag n invoices: one click marks every invoice allocated to that job alone as on the job account, so the aging table reads them as owner-secured from then on. Split invoices are left for Edit invoice.',
  ],
}

export default note
