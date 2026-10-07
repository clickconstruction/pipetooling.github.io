import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4811',
  date: '2026-10-07',
  title: 'Customer timeline: the story of a customer, worked out',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules behind the coming Customer timeline are in the app: which jobs belong to a customer, when each job starts and ends, and what each day shows.',
    'It counts what a customer owes the way the Pipeline does, and replays what they owed on any past day.',
    'A GC’s timeline holds the jobs it is the GC on as well as the jobs it pays for, and names who pays on each.',
    'Nothing on a screen reads it yet. The timeline window comes next.',
  ],
}

export default note
