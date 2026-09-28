import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4056',
  date: '2026-09-28',
  title: 'Pipeline: the top cards agree with the section headers',
  kind: 'fix',
  highlights: [
    'The "Waiting on customers" and "In collections" cards at the top of the Pipeline now read the same rows as the Billed Awaiting Payment and Collections headers below them, once those sections have loaded.',
    'Before, a job moved to Collections from another screen showed up in the section right away while the cards kept the numbers from when the page opened — "7 jobs · $24,338" over a header saying "(8) · $24.6k".',
  ],
}

export default note
