import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6435',
  date: '2026-11-03',
  title: 'An older set’s presses stay inside its card on a phone',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a phone, the Development page’s Plans look lists a part’s older sets under its card. The Open, Build from this set and remove presses ran past the card’s right edge and pushed the page sideways.',
    'The three presses now take a line of their own under the set, at the right, and stay inside the card. The date still leads each set.',
    'On a desk the table is as it was.',
  ],
}

export default note
