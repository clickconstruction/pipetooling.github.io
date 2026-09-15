import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3455',
  date: '2026-09-15',
  title: 'Bill Customer: the owner-of-record line no longer depends on the customer having an email',
  kind: 'fix',
  highlights: ['On a GC job whose customer has no email on file, Bill Customer now still shows what the appraisal roll says about the owner of record, with Use.'],
}

export default note
