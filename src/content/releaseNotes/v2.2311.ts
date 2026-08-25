import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2311',
  date: '2026-08-25',
  title: 'Fix a job without losing your place',
  kind: 'fix',
  highlights: [
    'Opening a job from the Data health list now stacks the job window on top — close it and you\'re back in the list with your filters, search, and scroll untouched.',
    'Anything you save in the job refreshes the list and the medians behind it automatically.',
  ],
}

export default note
