import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7574',
  date: '2026-11-17',
  title: 'Task notes: a note that tags a teammate shows who it waits on',
  kind: 'feature',
  highlights: [
    'A task note that tags a teammate now shows the name as a chip, and after it who the note waits on and for how long. Your own name is amber.',
    'Once the person writes a note on that task, the words change to say who answered.',
    'Any note you type on a task answers a tag that waits on you there. A tick does not.',
    'The @ button in a task’s note box is switched on for the developers first. It opens to the team with the next update.',
  ],
}

export default note
