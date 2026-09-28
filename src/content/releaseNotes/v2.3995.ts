import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3995',
  date: '2026-09-28',
  title: 'Schedule: recording a no-call, no-show has tests',
  kind: 'fix',
  highlights: [
    'Recording a no-call, no-show from the Schedule files the incident first, then marks the day off, then clears the person’s blocks — and does nothing more if the incident is refused. That order now has automated checks behind it. Nothing on the screen changed.',
  ],
}

export default note
