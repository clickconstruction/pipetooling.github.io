import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4855',
  date: '2026-10-07',
  title: 'Lien desk: the notice footer is one row',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a notice that is waiting, ready, printed or held, the bar at the bottom of its pane is one row. A chip at the left says the state in a few words, like Approved · leader’s word · Oct 7. Hold the mouse on it to read the whole line.',
    'Already mailed? Record it, Just this one, Back to ready and the other side doors are links now. The one button, like Send the run, sits at the right end.',
    'Before this, the sentence pushed the buttons to a second row and Send the run ended up alone at the bottom left.',
  ],
}

export default note
