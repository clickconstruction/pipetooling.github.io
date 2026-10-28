import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6028',
  date: '2026-10-28',
  title: 'Put it back finds a skip on a residential customer’s Pipeline job',
  kind: 'fix',
  highlights: [
    'Put it back on a residential customer’s step card now undoes the skip the card just made. Before this the skip filed on the Pipeline job, but the card looked for it under a GC project and found nothing, so the press did nothing.',
    'A skip on a Pipeline job’s step now reads back on that job in the step card and the morning run, the same way a hold or a note does.',
  ],
}

export default note
