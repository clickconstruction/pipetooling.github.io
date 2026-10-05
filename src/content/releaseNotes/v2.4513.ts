import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4513',
  date: '2026-10-04',
  title: 'Overhead: Man hours, the office against the field',
  kind: 'feature',
  highlights: [
    'People → Overhead has a new Man hours card above the day table. It shows field hours, office hours and bid hours side by side, with the office share of the total.',
    'A switch reads it by Week, Month, Quarter or Year. Weeks are pay weeks, Sunday to Saturday.',
    'A row says when its period is not over yet, when the clock started partway through it, and how many of its hours are still waiting for approval. Per week lets you compare a part month with a full one.',
    'It counts the same recorded hours as the day table under it, so a week on the card matches that week in the table. It shows hours only, never a wage or a dollar.',
  ],
}

export default note
