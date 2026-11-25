import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8585',
  date: '2026-11-25',
  title: 'Messages at large text: the reply box’s small caption stays on one line',
  kind: 'fix',
  highlights: [
    'With the phone’s text set large, the small caption in the empty reply box wrapped to two lines and sat on the grey words.',
    'The caption now stays on one line at the foot of the box. A caption too long for the box ends in dots.',
    'The box is the same height as before.',
  ],
}

export default note
