import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5371',
  date: '2026-10-12',
  title: 'Lien desk: each envelope in the run is a card that shows its own steps (run train, PR 3)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The run’s table of rows is gone. Each envelope is a card: an envelope drawn open, sealed or postmarked, its own row of steps, one chip that says where it is, and only the buttons that move it.',
    'A card that waits on the leader turns amber and says so. A sealed card turns green. The method menu, the number box, the courtesy tick, Leader here sign and the Preview and Print links are where they were, just inside the card.',
    'On a phone the right column drops under the card so nothing is cut off.',
  ],
}

export default note
