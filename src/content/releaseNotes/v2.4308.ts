import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4308',
  date: '2026-10-01',
  title: 'Lien notices: a job worked over several months shows its earliest notice date',
  kind: 'fix',
  highlights: [
    'A job under a GC owes a lien notice for every month the crew worked. The Lien desk’s Calendar and the Pipeline’s Billed rows only counted the last month, so a job worked July through September said its notice was due Dec 15 when July’s was due Oct 15. Both now show the earliest month still owed.',
    'On the Calendar, each GC’s line names that earliest date and the GCs sort by it, so Southern Post, Burd and Loberg now sit with the other Oct 15 notices instead of near the bottom.',
    'Every flag on a row now names its month, and a job with no property kind draws its flags on the earlier, residential dates its words already used. The lien filing date still counts from the last month worked.',
  ],
}

export default note
