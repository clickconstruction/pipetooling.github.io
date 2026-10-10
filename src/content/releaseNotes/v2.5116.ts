import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5116',
  date: '2026-10-09',
  title: 'The Pipeline leaves out ZZ test jobs',
  kind: 'infra',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'Jobs whose name or customer starts with ZZ are tests. They no longer show on the Pipeline, its counts and totals, or Quickfill.',
    'Real jobs and their money are unchanged. A dev still sees the test jobs.',
  ],
}

export default note
