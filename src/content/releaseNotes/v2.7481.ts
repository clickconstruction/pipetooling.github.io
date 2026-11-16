import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7481',
  date: '2026-11-16',
  title: 'Lien desk: un-print one notice from its own row',
  kind: 'feature',
  highlights: [
    'In the run window, a row’s Printed tick is now a press. It asks first, then puts that one notice back in Approved · to print.',
    'Right after you press Printed ▸ on a row, a line offers Undo the Printed mark, for a press made by mistake.',
    'The approval stands, and a copy that printed stays in the job’s Documents. A number typed on that row and not recorded is dropped.',
    'Take back… under More still takes back every printed notice in the run.',
  ],
}

export default note
