import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2949',
  date: '2026-09-06',
  title: 'Reconciliation keeps a receipt and a "Last reconciled" list',
  kind: 'feature',
  highlights: [
    'Every check on Banking → Reconciliation now leaves a receipt: who ran it, when, how many statement transactions were found in the books (412 of 412), which months have something missing, and whether the live balance matched.',
    'The receipt says what the check is and is not: presence only, statement → books. It confirms nothing from the bank is missing; it does not compare amounts or look for rows that exist only in the books.',
    'A "Last reconciled" list under the account cards shows the ten most recent runs, so "did the books match the bank on Friday?" has an answer after the tab is closed.',
    'New guide: "reconcile the books against bank statements".',
  ],
}

export default note
