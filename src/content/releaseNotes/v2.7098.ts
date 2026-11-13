import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7098',
  date: '2026-11-12',
  title: 'The HR Timeline shows an entry as corrected, with a door to the correction',
  kind: 'feature',
  highlights: [
    'An entry that a later entry corrected now shows Corrected with the day. Press it to open the correction. The correction shows what it corrects.',
    'Press Correct this entry… on any entry or piece of evidence. The entry box opens with that line picked, as a correction or as an addition.',
    'A link made by mistake comes off with a reason. It stays on the record.',
    'In the narrative, a section that rests on an entry corrected since shows its count in amber.',
  ],
}

export default note
