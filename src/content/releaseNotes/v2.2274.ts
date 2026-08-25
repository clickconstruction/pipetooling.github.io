import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2274',
  date: '2026-08-25',
  title: 'The task ✓ answers instantly — with five seconds to undo',
  kind: 'feature',
  highlights: [
    'Pressing the ✓ on a task row now responds the moment your finger lands: the box fills green with a little pop and the title strikes through — the save happens behind it.',
    'Every completion leaves a quiet bar at the bottom for five seconds with an Undo button and a draining timer. Undo brings the task right back — on a Missed row it brings back every copy.',
    'Notifications and the next repeat are held until the five seconds pass, so an undone completion pings no one and schedules nothing.',
  ],
}

export default note
