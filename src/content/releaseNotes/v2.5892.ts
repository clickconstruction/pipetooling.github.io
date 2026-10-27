import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5892',
  date: '2026-10-26',
  title: 'Legal desk: the Timeline reads first, one Add to the timeline form',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Timeline tab opens on the line itself: the always-open form folds behind one Add to the timeline button at the right of the lane chips, so the first entry sits where the form used to.',
    'One form replaces Plan a step and Record what happened. The day decides which you are adding: a day ahead of today is a planned step, today or earlier is what happened, and the tag beside the day flips it.',
    'Serves the deadline is no longer a standing select. When the day lands just before an open lien-clock deadline, the form asks in one line whether the step serves it; Serves a deadline… still opens the full pick.',
    'The documents that prove an event pick as chips, the first three plus N more…, instead of a checkbox list.',
  ],
}

export default note
