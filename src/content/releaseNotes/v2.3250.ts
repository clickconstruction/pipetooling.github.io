import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3250',
  date: '2026-09-10',
  title: 'Pipeline: the report pill sits to the right of + Add',
  kind: 'fix',
  highlights: [
    'In a job\'s activity box on Jobs → Stages, the report pill now sits to the right of + Add, and both pills are the same height on one line.',
    'Nothing else changes: the pill still opens New report on that job.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
