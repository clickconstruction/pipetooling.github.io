import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2307',
  date: '2026-08-25',
  title: 'Follow-ups button shows its count',
  kind: 'feature',
  highlights: [
    'The Jobs Pipeline Follow-ups button now wears a count of jobs waiting for review — the same number the deck shows once opened.',
    'The count refreshes when you close the deck, so working the queue visibly shrinks it. At zero the badge disappears.',
  ],
}

export default note
