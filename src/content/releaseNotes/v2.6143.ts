import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6143',
  date: '2026-10-30',
  title: 'The chase clock as a strip of days on the Call queue and Waiting to hear',
  kind: 'feature',
  highlights: [
    'Each pending bid on the Call queue can draw its clock as a strip of days: the send as a blue dot, each contact as a filled dot, the call-again day as a diamond, the day its bid tab becomes worth asking for as a green tick, and today as a blue column.',
    'A day someone promised draws as a solid diamond. A day the rule made, seven days after the last contact, draws dashed and says so under the strip. A bid is to chase when today has reached its diamond, and you can see it coming.',
    'With the strip on, the header sentence goes and the chips keep the counts. On Waiting to hear the open bid draws the same strip in place of its Last contact line.',
    'The strip is a prototype from punch list #217, Show it, don’t say it, and sits behind a press on each surface. Both read as before until you press Show the strip of days. Press Show today’s look to go back. Nothing about the queue, the days or the chips has changed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator', 'primary', 'superintendent'],
}

export default note
