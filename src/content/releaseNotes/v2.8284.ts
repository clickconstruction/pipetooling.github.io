import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8284',
  date: '2026-11-22',
  title: 'Materials on site: loading a box takes fewer presses',
  kind: 'feature',
  highlights: [
    'Add a part opens with choices: what the box says is in it, and the names the job already has. What you type is offered first. The number has +10, +25 and +100, and Add 40 and another part keeps the sheet open.',
    'A part you put into a box that held none of it is counted as it goes in, so the box does not ask for a count of what you just put in. When the box already held some, no count is written.',
    'Add a container has How many beside What is in it. Fill it and the new box takes its first part in the same press.',
    'On a phone the office’s Materials page lists one row a box. A row opens the box and comes back. An empty box reads Empty and its row adds its first part. A notice about box photos is one line.',
  ],
}

export default note
