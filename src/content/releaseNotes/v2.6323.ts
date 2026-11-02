import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6323',
  date: '2026-11-02',
  title: 'A clock-out with no signal keeps your job',
  kind: 'fix',
  highlights: [
    'A Clock Out pressed with no signal used to land with no job on it, and the session’s hours read No Job or Bid. Now the clock-out keeps the job or bid you were clocked into.',
    'The job list in the clock-out window still works as before. Pick another job and the hours go there. Press Clear and the session has no job, as you asked.',
  ],
}

export default note
