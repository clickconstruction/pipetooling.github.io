import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2756',
  date: '2026-09-04',
  kind: 'fix',
  title: 'A tripwire for lists that quietly stop at 1,000 rows',
  highlights: [
    'The database answers big unpaged reads with the first 1,000 rows and no warning. That is what hid parts on Takeoffs; it has bitten the Crew P&L, team labor, and the People Review tab before.',
    'The app now notices any such read the moment it happens and flags it in the browser console, naming the table, so the next one gets fixed before anyone reports "it isn\'t saving".',
    'Nothing changes on screen; this is the safety net under the fix that shipped just before it.',
  ],
}

export default note
