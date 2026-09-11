import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3350',
  date: '2026-09-11',
  title: 'Who pays: a one-time sweep marks the existing GC-pays jobs',
  kind: 'fix',
  highlights: [
    'A script marks every job that was entered with the GC as the customer as "Bills go to: GC", so the rule survives if the site owner is later put back as the customer. The office runs it once.',
    'The two paid jobs that carried the GC\'s address in the customer email get the same mark.',
    'Nothing else changes on those jobs — no bill, statement or portal moves.',
  ],
}

export default note
