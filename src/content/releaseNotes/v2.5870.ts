import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5870',
  date: '2026-10-26',
  title: 'Estimates: the accept link’s memory lives in one tested module',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, the rules for the customer accept link — what counts as a usable link, and how the page remembers it per estimate for the length of the tab — now live in one tested module.',
    'Nothing changes on screen. Sending, resending and reopening a sent estimate show the same link as before.',
    'New tests pin the rules: a usable link points at the accept page and carries a token, the preview stand-in never counts, and a blocked browser store never breaks the page.',
  ],
}

export default note
