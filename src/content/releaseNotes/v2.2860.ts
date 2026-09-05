import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2860',
  date: '2026-09-05',
  title: 'The bench reaches the pickers and the nags',
  kind: 'feature',
  highlights: [
    'The work order Sub step lists active subs first; benched subs sit behind "+ N on the bench" and can still be picked, since offering work is how they come back.',
    'The Assign… list on People → Subs groups the roster into Active and On the bench.',
    'A benched sub shows one gray "on the bench" chip on People → Users and the Person rail, and their paperwork nags pause while they are benched. Sessions waiting still count.',
  ],
}

export default note
