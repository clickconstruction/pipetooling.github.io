import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8614',
  date: '2026-11-26',
  title: 'Bring back: a sub with no wage on file skips the Wage row',
  kind: 'fix',
  highlights: [
    'When you bring back a subcontractor who has no wage on file, the Wage row now reads Not needed for their kind and is skipped, as Team is for the office.',
    'Before, the row could not be left open, so a sub came back only once someone typed a wage up. A sub is paid through sub labor.',
    'A sub with a wage someone set still gets Keep or Change. Everyone else’s Wage row works as before.',
  ],
}

export default note
