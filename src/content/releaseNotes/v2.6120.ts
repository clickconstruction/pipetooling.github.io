import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6120',
  date: '2026-10-30',
  title: 'Green words read in dark mode across the app',
  kind: 'fix',
  highlights: [
    'In dark mode, many green words were still a dark green on the dark card. They now take the theme’s green, light on dark and unchanged in light mode.',
    'Among them: a profit or the money in, a best price, a Paid amount, a link that checked out, a count that is clear and a count on the Lien desk calendar.',
    'Green buttons and badges with white words keep their green, which reads in both themes.',
    'Nothing else about these lines changed.',
  ],
}

export default note
