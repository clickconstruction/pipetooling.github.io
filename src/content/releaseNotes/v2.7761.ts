import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7761',
  date: '2026-11-18',
  title: 'Pipeline: Open Invoice works on a job the search found for you',
  kind: 'fix',
  highlights: [
    'On the Pipeline, a search can find a job by something that is not on its row, such as an old job number. Open Invoice on that job now jumps to the bill.',
    'Before, it could say to clear the search first, though the bill was on screen.',
  ],
}

export default note
