import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2115',
  date: '2026-08-22',
  title: 'Count rows: pick the unit',
  kind: 'feature',
  highlights: [
    'Every count row now has a unit — each, ft, sq ft, or px — shown beside the count on the Count Sheet and the classic table. It follows the fixture name ("ft of …" is feet) until you pick one, and then it sticks even if the row is renamed.',
    'Importing from CountTooling stamps each row\'s unit on arrival, so line types land as feet and counters as each — no guessing later.',
    'Quick add and the Add/Edit row forms get an ea / ft toggle; the Counts CSV export gains a Unit column.',
  ],
}

export default note
