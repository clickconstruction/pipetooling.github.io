import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2346',
  date: '2026-08-26',
  title: 'Manage: scheduled tasks stop counting as open',
  kind: 'fix',
  highlights: [
    'A one-off dated in the future no longer wears the red "open today" chip — it moves to its own Scheduled section with a blue "starts Mon, Aug 31" chip.',
    'The One-offs header now counts only tasks someone can act on today, so "open" means open.',
  ],
}

export default note
