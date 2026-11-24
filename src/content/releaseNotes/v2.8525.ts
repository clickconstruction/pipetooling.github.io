import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8525',
  date: '2026-11-24',
  title: 'Lien desk: no release before the bank clears the check',
  kind: 'feature',
  highlights: [
    'A check counts toward a lien release once the bank clears it. That is the day the bank names for the check, which comes about a week after the deposit.',
    'In Payoffs, a lien paid by a check that has not cleared reads Waits for the bank and has no release button. The Release of record tab holds its print and save the same way, unless a leader types why it goes out sooner.',
    'A place in Payoffs says when a check for exactly what pays its liens off is at the bank, and the day it clears. On that day the Lien desk line turns amber and says the check is ready to record.',
    'One check for this place opens on what the bank read off the check, so nobody types it. It does not record a check the bank has not cleared.',
  ],
}

export default note
