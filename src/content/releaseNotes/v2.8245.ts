import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8245',
  date: '2026-11-21',
  title: 'Job Mode: Is it as told? says when the app could not read the list',
  kind: 'fix',
  highlights: [
    'When the app itself refused to read the list, the card showed nothing, the same as a lost signal. Nobody knew a question was missing.',
    'The card now says so and gives the reason. A lost signal still shows nothing, and the card comes back by itself.',
  ],
}

export default note
