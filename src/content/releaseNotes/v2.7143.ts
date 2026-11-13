import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7143',
  date: '2026-11-13',
  title: 'Supply houses: the open house’s row reads in dark theme',
  kind: 'fix',
  highlights: [
    'On Materials → Supply houses in dark theme, the house you opened drew as a near-white band with near-white words. Its name and its balance could not be read.',
    'The open row is now a dark blue band in dark theme, with the name and balance at full strength.',
    'Light theme looks exactly as it did.',
  ],
}

export default note
