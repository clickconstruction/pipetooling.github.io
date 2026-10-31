import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6218',
  date: '2026-10-31',
  title: 'Blue buttons take one deeper blue, so their white words read',
  kind: 'fix',
  highlights: [
    'The app’s everyday blue buttons were a lighter blue, and their white words were harder to read than the rest. They now take the deeper blue the other blue buttons already use, in light and dark mode.',
    'That covers about 460 buttons, picked chips and counts, among them Task and New Bid in the header. Their words stay white.',
    'Blue lines, borders, dots, icons and words keep their colour.',
  ],
}

export default note
