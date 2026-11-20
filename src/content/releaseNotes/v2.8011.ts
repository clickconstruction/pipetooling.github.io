import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8011',
  date: '2026-11-19',
  title: 'Tasks and boxes: Use where I am says Precise Location is on, and shows the way to the switch when it looks off',
  kind: 'feature',
  highlights: [
    'Use where I am on a task, and Use my location on a box, now say how your phone is doing: Precise Location is on, or the signal is weak.',
    'When your phone gives only a rough area, the map is not moved. The line says Precise Location looks off and lists the steps to the switch for your phone.',
    'How far am I?, Show where I am, I found it and Pin it here no longer work from a rough area. They pin nothing and say no distance, and show the same steps.',
    'A rough reading is no longer told to try again in the open, since the open sky does not fix it.',
  ],
}

export default note
