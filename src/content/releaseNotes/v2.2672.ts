import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2672',
  date: '2026-09-03',
  title: 'Time-approvals card: count fixed',
  kind: 'fix',
  highlights: [
    'The new "waiting on approval" Dashboard item counted through a role check that no longer exists, so it never appeared — the check now uses the current role helpers and the card works as announced.',
  ],
}

export default note
