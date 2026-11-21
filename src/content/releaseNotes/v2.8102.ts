import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8102',
  date: '2026-11-20',
  title: 'HR files: a plan you dropped can no longer be written by an agent',
  kind: 'fix',
  highlights: [
    'A plan an agent kept for your yes, and that was then dropped, is now refused if any session tries to apply it. Before, a session that still held the plan could write it.',
    'A kept plan that rewrites a person’s summary or narrative is refused once anyone has saved that text since. Before, it could write over the newer text days later.',
    'A long plan can no longer be written twice by two sessions. The record that stops a second write had been losing its mark on long plans.',
    'Nothing on a real file was affected: no plan was written twice, and no dropped plan was applied.',
  ],
}

export default note
