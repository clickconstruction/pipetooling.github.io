import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3625',
  date: '2026-09-19',
  title: 'Sub sheet payments: Move and Remove reachable on a phone; an evening move no longer reads as tomorrow',
  kind: 'fix',
  highlights: [
    'On the Sub Labor sheet form, a payment row is now two lines — date, type and amount, then the memo beside Edit · Move… · Remove. Before, the table was wider than the form: the date was cut off on a desktop, and on a phone the ⋯ menu holding Move and Remove sat off-screen where it could not be tapped.',
    'The grey Moved / Removed line is dated by the company calendar. A payment moved after 7 PM used to read as the next day, on the office sheet and on the sub\'s portal alike.',
    'Found on the first live run of move-and-remove, on two throwaway sheets: the move, the What changes numbers, the lines on both sheets, Remove with a reason and Undo all behaved as drawn.',
  ],
}

export default note
