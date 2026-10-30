import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6130',
  date: '2026-10-30',
  title: 'A map pin’s count, a robot’s X grade and the Dashboard’s calendar count read in both themes',
  kind: 'fix',
  highlights: [
    'A count on a map pin now reads on its colour: dark on the bright pins like amber, yellow and light green, white on the deep ones.',
    'The X grade on a robot’s badge is a deeper grey, so its white X reads.',
    'In dark mode the count on the Dashboard’s blue calendar is dark on the light blue instead of white.',
    'Each was a count of one character, which What everyone sees did not check before.',
  ],
}

export default note
