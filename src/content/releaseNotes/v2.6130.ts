import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6130',
  date: '2026-10-30',
  title: 'A count of one digit is checked for contrast, and the counts it found now read',
  kind: 'fix',
  highlights: [
    'What everyone sees now checks a count of one digit or a single letter. It skipped them before, so a lone 0 in dark green on the dark card passed unseen.',
    'In dark mode the count beside Messages in the top bar, and the count on the Dashboard’s blue calendar, are dark on their light colour instead of white.',
    'A count on a map pin now reads on its colour: dark on the bright pins like amber, yellow and light green, white on the deep ones.',
    'The X grade on a robot’s badge is a deeper grey, so its white X reads.',
  ],
}

export default note
