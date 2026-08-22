import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2111',
  date: '2026-08-22',
  title: 'Partner ledger weeks: the math flows',
  kind: 'fix',
  highlights: [
    'The weekly cards now tell the same story as the Full ledger: every week opens exactly where the last one closed, all the way back to the first week of the partnership.',
    'Back-charges and card charges now appear as red lines in the week they happened — before, they were counted in the total but never shown, so a week could open at one number and close somewhere unexplainable.',
    'Payouts show in the week they were actually paid, and ‹ Older now walks the entire history instead of stopping after eight statements.',
  ],
}

export default note
