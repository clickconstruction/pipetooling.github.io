import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7241',
  date: '2026-11-13',
  title: 'The dev seat edits a box and fixes a part\'s typed name on site',
  kind: 'feature',
  highlights: [
    'A box on a job site can now be renamed from the dev seat, the same way the Edit window does it. Its kind and its where line can change too.',
    'A part name typed wrong on site can be fixed from the dev seat for the whole job, and put back with an undo.',
    'Before anything is written, the plan lists every box the name is in. Where two lines would become one, it says what the one line will read.',
    'A box history and a rename record made this way name the robot and the developer behind it. Nothing changes for a rename made in the app.',
  ],
}

export default note
