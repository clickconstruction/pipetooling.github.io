import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7353',
  date: '2026-11-15',
  title: 'The run closes a notice whose job was paid',
  kind: 'feature',
  highlights: [
    'In the run, notices on jobs that owe $0 now sit under one line below the checklist, like “5 paid notices · nothing to send”. The checklist above lists only what can still go.',
    'Close 5 paid notices… on that line asks first, then closes them. Nothing is mailed, each notice leaves the run and the desk, and the copy that printed stays in the job’s Documents.',
    'Each paid row has its own Close… for one notice at a time. A notice that cannot close stays on the screen with its reason.',
    'A job that owes again comes back to the desk by itself. Take back is still there for a printed run that did not go out.',
  ],
}

export default note
