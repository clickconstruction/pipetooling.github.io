import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7300',
  date: '2026-11-15',
  title: 'The job window on a phone: the ✕ rides with the tabs',
  kind: 'fix',
  highlights: [
    'On a phone the ✕ no longer floats over the job as you scroll, where a tap on a line’s ⋯ or on a cost could close the window instead. It scrolls away with the name and the tabs.',
    'Scroll back up and the tabs come back at the top with the ✕ at their right, in its own thumb-sized square, over nothing.',
  ],
}

export default note
