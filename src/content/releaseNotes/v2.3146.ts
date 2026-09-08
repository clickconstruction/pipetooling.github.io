import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3146',
  date: '2026-09-08',
  title: 'Help: which stage kind to pick — Order, Any, or not a stage',
  kind: 'feature',
  highlights: [
    'The guide "split a job into stages and bill stage by stage" now answers the two questions a new assistant asks: which kind does this row get, and does the customer see a "—" line.',
    'Two-question rule of thumb, a table of common rows, and one worked bill that uses all three kinds from rough-in to the final draw.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
