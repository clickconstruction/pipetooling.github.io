import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6390',
  date: '2026-11-02',
  title: 'A bid marked lost with every GC now leaves Not yet won or lost, even with a same-letter GC on it',
  kind: 'fix',
  highlights: [
    'Marking every GC on a bid Lost now rolls the bid to Lost even when a GC on its Also sent to list got the same letter with no packet of its own. That GC rides the bid and no longer holds it in Not yet won or lost.',
    'A same-letter GC still reads its answer from the bid, as before. It never decides the bid on its own.',
    'The greyed Archive from board press on a bid with GC packets now points at the GC cards in the Sent panel instead of the locked Win / Loss segment. When every GC has said no but the bid still reads open, it says the bid belongs in Lost and names the press that moves it.',
    'A sent bid that is already Won, Lost or Started says it is off the working piles and there is nothing to archive.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'estimator'],
}

export default note
