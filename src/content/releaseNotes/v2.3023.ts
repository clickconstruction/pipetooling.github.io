import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3023',
  date: '2026-09-07',
  title: 'Deploys queue instead of cancelling each other',
  kind: 'infra',
  highlights: [
    'On a busy day every merge cancelled the deploy already running, so the live site could sit hours behind. Deploys now wait their turn: one runs, the newest merge waits behind it, and the site is never more than one deploy behind.',
  ],
}

export default note
