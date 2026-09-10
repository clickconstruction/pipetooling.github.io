import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3211',
  date: '2026-09-09',
  title: 'Bid Board: the thin progress bar under the jump icons is evenly spaced',
  kind: 'fix',
  highlights: [
    'The ten ticks under each row\'s jump icons now sit an equal distance apart. The wider gaps between phases made the bar look uneven, so they are gone; the phases are still labelled on the full strip when you open a row.',
  ],
}

export default note
