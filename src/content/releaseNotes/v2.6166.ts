import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6166',
  date: '2026-10-30',
  title: 'Legal desk Timeline: open the paper from the line, or land on its Evidence row',
  kind: 'feature',
  highlights: [
    'A document on the Timeline now has two doors. Open the paper opens the file itself in a new browser tab, and the Timeline stays where it was.',
    'Show on Evidence switches to the Evidence tab, scrolls to that paper’s row and lights it for a few seconds. The address carries the row, so a reload or a pasted link lands on it too.',
    'A filter that would hide the row clears, and one line says so. A paper no longer on the matter says so instead. A paper you may not open says why under the line.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
