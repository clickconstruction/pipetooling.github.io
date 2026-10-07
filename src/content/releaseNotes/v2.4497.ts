import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4497',
  date: '2026-10-04',
  title: 'Submittals: a step pill keeps its grey outline when it goes back to grey',
  kind: 'fix',
  highlights: [
    'On the Submittals strip, a pill that went from lit back to grey could lose its outline colour, for example when you switched to an older revision.',
    'Each pill now keeps the right outline in every state.',
  ],
}

export default note
