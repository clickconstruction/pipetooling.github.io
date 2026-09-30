import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4260',
  date: '2026-09-30',
  title: 'GC statement email: the payments we have received, and where each went',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'Under the total, the statement lists every payment the GC sent in the last 30 days, newest first.',
    'Each one names the check, the day it came and the property and job it went to.',
    'When none came, the statement says so, and asks the GC to reply if they sent one.',
    'Statements the app sends and statements you copy both carry the list.',
  ],
}

export default note
