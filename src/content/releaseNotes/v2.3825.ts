import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3825',
  date: '2026-09-25',
  title: 'The owner’s portal shows the lien notice on their property',
  kind: 'feature',
  highlights: [
    'Once a lien notice to the property owner is recorded as sent, their portal shows it on its own: what the builder has not paid and for which months, what they may hold back, the three clean ways to finish it, and a Call button. A draft never shows.',
    'An owner whose builder owes on their property no longer reads “You’re all paid up” — the page says “Nothing is billed to you directly. Work on your property is billed to your builder.”',
    'Shared bills on a noticed property read “On your property, billed to your builder” instead of “not yours to pay”, each marked “on the notice above”.',
  ],
}

export default note
