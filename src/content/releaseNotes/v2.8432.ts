import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8432',
  date: '2026-11-24',
  title: 'The dev seat reads how the database answers a slow screen',
  kind: 'infra',
  highlights: [
    'A developer can now see how the database works out the Agreements list and the recorded hours behind job cost, as a signed-in person sees them. That shows whether a screen looks records up directly or reads a whole list to find them.',
    'It reads a short, fixed list of questions and nothing else. It cannot change anything, and only a developer can use it.',
    'Nothing changes on any screen.',
  ],
}

export default note
