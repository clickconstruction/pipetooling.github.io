import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6617',
  date: '2026-11-07',
  title: 'The Task window says what Done when… is for, shows the photo switch, and names what the card will carry',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'estimator', 'subcontractor', 'helpers', 'superintendent'],
  highlights: [
    'The closed Done when… row reads what done means, one line each, ticked off on the card, so it no longer looks like a timing question above When.',
    'Asks for a photo at the finish sits beside the row where a writer sees it on a plain task too. It still turns on by itself once a line is written.',
    'The green sentence under When adds what the card will carry, 3 Done when… lines, a photo at the finish. Picking Repeats says that a repeating task keeps its tick and a one-off gets the % ring.',
  ],
}

export default note
