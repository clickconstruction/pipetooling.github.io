import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2143',
  date: '2026-08-22',
  kind: 'fix',
  title: 'Checklist notes: the note box fits on a phone',
  highlights: [
    'On a phone, the Add-a-note box under a task now spans the full width and the Post / ✓ Post & complete buttons sit beneath it — no more three-character box beside two wide buttons.',
    'The box grows as you type (up to about five lines) so a longer note wraps instead of scrolling off to the side. Enter posts; Shift+Enter starts a new line.',
    'Applies everywhere the note box appears: Review → Outstanding by person, Today, Manage, and vehicle tasks. On a desktop nothing moves.',
  ],
}

export default note
