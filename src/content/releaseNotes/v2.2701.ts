import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2701',
  date: '2026-09-03',
  title: 'Person Desk: one drawer for one person',
  kind: 'feature',
  highlights: [
    'Tap a name on People → Users or People → Subs and a drawer opens with everything about that person: whether they are clocked in, sessions waiting on approval with a one-tap queue pinned to them, their team lead and clock alerts, portal and paperwork for subs, and their account.',
    'The header shows the three pieces a person can be — login, roster row, pay name — and turns anything missing or out of step into a button: create the roster row, link the account, or reconcile a drifted name. Nothing happens silently.',
    'Rows you cannot change still show, with a "dev only" tag, so you can see the state and know who to ask. The Desk adds no new permissions.',
    'On a phone the drawer fills the screen. A link with ?person= opens it from anywhere.',
  ],
}

export default note
