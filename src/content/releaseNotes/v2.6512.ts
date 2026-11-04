import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6512',
  date: '2026-11-04',
  title: 'The Settings search reads on a narrow screen',
  kind: 'fix',
  highlights: [
    'A result with a long name, such as How fast a change ships, now reads as one line or wraps like a sentence, never one word a line.',
    'The grey "in People & teams →" trail sits after the name when there is room and drops under it when there is not, never on top of it.',
    'A result that opens a whole tab says "a tab →" instead of repeating its own name.',
    'When a result matched one of its other words, that word stays on its own last line.',
  ],
}

export default note
