import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4984',
  date: '2026-10-08',
  title: 'GC mode: the rules for billing the customer on a GC job',
  kind: 'infra',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Sending our pay application to a GC customer files it as it went, line by line. The first one opens the job’s billing job in the Pipeline, which no crew sees.',
    'Recording what the architect certified makes the bill on that job, so the customer pays it from their statement like any other bill.',
    'A certificate and its bill stay as recorded. Nothing on screen uses these yet: Bill the customer comes next.',
  ],
}

export default note
