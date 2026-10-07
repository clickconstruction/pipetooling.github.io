import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4848',
  date: '2026-10-07',
  title: 'GC mode: the schedule’s writes, so two people on one schedule never overwrite each other',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The GC mode schedule gets its writes. Every change to a schedule’s plan checks the version it read. When two people change one schedule at once, the second is told what changed and by whom, and nothing of theirs is lost.',
    'The plan changes only through those writes, even for a dev, and each change is kept with its words. Only a dev can use them while they are built, and no screen calls them yet.',
  ],
}

export default note
