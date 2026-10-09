import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5085',
  date: '2026-10-09',
  title: 'GC mode: record inspections and the job’s own work on the schedule',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Pressing an inspection’s bar on a GC project’s schedule lets a dev record that it passed, or that it failed with the re-inspection day.',
    'A failed inspection moves to its re-inspection day, and the work that waits on it moves out with its gaps kept.',
    'The job’s own work, like cure time, goes on the schedule as a bar of its own. The office marks it done or takes it off.',
    'The Milestones card adds, moves and takes off the dates the job must meet.',
  ],
}

export default note
