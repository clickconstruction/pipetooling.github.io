import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3350',
  date: '2026-09-11',
  title: 'Who pays: the existing GC-pays jobs now say so',
  kind: 'fix',
  highlights: [
    'Every job that was entered with the GC as the customer is now marked "Bills go to: GC", so the rule survives if the site owner is later put back as the customer.',
    'The two paid jobs that carried the GC\'s address in the customer email carry the same mark.',
    'Nothing else changed on those jobs — no bill, statement or portal moved.',
  ],
}

export default note
