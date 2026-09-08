import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3169',
  date: '2026-09-08',
  title: 'The phone People board keeps up when the phone turns',
  kind: 'fix',
  highlights: [
    'Your pick of the phone board or the desktop grid now sticks at any width — a phone turned sideways in a truck mount keeps the board, and a tablet or half-width window can choose it too. The switch to the other view sits at the bottom of both.',
    'Copy to techs now reads each tech\'s day for the day the copy will land on; off that day the cards point you back to it. Whole team applies only to a real crew lane, and a tech marked Not coming in is not offered when filling several days.',
    'Stepping to another week ends any copy, move or Copy to techs in progress instead of leaving it running out of sight.',
    'Tech cards now show the Late chip, sub badges, a per-block "no note" marker, and grey busy rows for work you cannot see; tap a Not coming in chip to clear it, as on the grid. Moving a block no longer reads its own row as busy, and a solo copy can land on the same tech another day.',
  ],
}

export default note
