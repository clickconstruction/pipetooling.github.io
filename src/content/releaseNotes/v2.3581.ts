import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3581',
  date: '2026-09-17',
  title: 'Payroll backfill: where each person stands',
  kind: 'infra',
  highlights: [
    'The backfill plan now ends with one row per person: what the app says is open, what was recorded but no send backs, what was sent but never recorded, the corrections, and the standing that results — positive still owed, negative ahead.',
    'Under the table, each unbacked payment is listed with its date and memo so it can be checked in the bank or explained.',
    'Nothing changes on screen in this release.',
  ],
}

export default note
