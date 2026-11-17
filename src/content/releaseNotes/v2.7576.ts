import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7576',
  date: '2026-11-17',
  title: 'Tag a teammate in a task note, with a count on Checklist',
  kind: 'feature',
  highlights: [
    'A task’s note box now has an @ button. The task’s own people are offered above the box, one press away. You can tag only people who can already open the task.',
    'When a task note tags you, a red number shows on Checklist and the note waits in Tagged task notes at the top of Today. Answer it there, or press No reply needed.',
    'The Dashboard’s Needs you line is now Tagged notes. It counts job notes and task notes together, and one window lists both.',
    'Review shows who a task waits on beside its note count. A tag on someone who has left now says so under You asked.',
  ],
}

export default note
