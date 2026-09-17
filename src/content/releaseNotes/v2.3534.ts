import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3534',
  date: '2026-09-16',
  title: 'Pipeline: the jump strip is one piece',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The Waiting → Working → Ready to Bill → Billed → Collections links above the board were five copies of the same code; they are now one small component with its own tests, so a change to one link cannot miss the others.',
  ],
}

export default note
