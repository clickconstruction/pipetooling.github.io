import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3911',
  date: '2026-09-27',
  title: 'My Time day editor: dragging and tapping the strip has tests',
  kind: 'fix',
  highlights: [
    'Turning a tap or a drag on the day strip into a time was written out three times inside the editor. It is one tested piece now, including the rule that a handle grabbed off-center does not jump.',
    'The editor reads a day’s clock sessions through one column list instead of two copies that had to be kept the same by hand.',
    'The default clock-out time for a forced clock-out and the draft session made from a typed hours cell have tests.',
    'Nothing on screen changes.',
  ],
}

export default note
