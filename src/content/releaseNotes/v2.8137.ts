import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8137',
  date: '2026-11-20',
  title: 'Before we start: on the line of time, the days they moved stay on the row',
  kind: 'fix',
  highlights: [
    'On a phone, a stage whose days ran the whole line had its red words cut off at the left edge. A stage that moved 32 days could read 2 days.',
    'At desk width the same words could sit over the stage’s name.',
    'The red words now sit under the row’s line, below the solid diamond, and stay inside the row at every width.',
  ],
}

export default note
