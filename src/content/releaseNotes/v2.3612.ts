import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3612',
  date: '2026-09-19',
  title: 'Supervision, PR 2: Schedule dispatch marks a block nobody on it can run',
  kind: 'feature',
  highlights: [
    'On the Schedule dispatch week, a block whose people all need supervision wears an amber "unsupervised" pill on its time line. A linked crew is judged as one: a master, or anyone the office has marked as able to run a job, covers the whole block.',
    'While you add or edit a block for someone who needs supervision, the window says so under their name and suggests a linked copy of a master or a qualified person. It never stops you saving.',
    'Nothing is assigned: the mark is read from the switch on each account and the people on the block. Someone the dispatch list does not know never triggers it.',
    'Also fixed from the previous release: the "needs supervision" / "can run a job" chip and the ⋯ menu entry on People → Users now show on every helper and sub row, on the desktop and the phone layout.',
  ],
}

export default note
