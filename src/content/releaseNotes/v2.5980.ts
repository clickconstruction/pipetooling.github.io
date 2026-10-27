import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5980',
  date: '2026-10-27',
  title: 'Where everyone stands keeps its names inside the band on a phone',
  kind: 'fix',
  highlights: [
    'On the Bid Board’s Health section, a name near either end of Where everyone stands slides in to stay inside the band. It no longer pushes the page sideways on a phone.',
    'Each marker now stands on the person’s true won rate, even at 0% or 100%. Before, a marker past 96% or under 4% stopped there.',
    'On a phone, a name that would land on its neighbor drops to the lower row. On a desk screen the band looks as it did.',
  ],
}

export default note
