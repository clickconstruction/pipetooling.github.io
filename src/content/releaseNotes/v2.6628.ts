import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6628',
  date: '2026-11-07',
  title: 'A task card photo taken with no signal waits on the phone',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary', 'estimator', 'subcontractor', 'helpers', 'superintendent'],
  highlights: [
    'A photo taken on a task card’s sheet with no signal is kept on the phone and goes to the card when the signal is back, as a job photo does. The tile reads Kept on the phone and you do not take it again.',
    'The line at the top of the screen counts it, as in Task photo from 3:12 PM · waiting to send · 1 photo with it. A finishing photo that proves a Done when… line lands on that line.',
    'The percent or the finish still needs the signal: when it does not land, the sheet stays open and says so, and a second Set or Done sends the kept photo no more.',
  ],
}

export default note
