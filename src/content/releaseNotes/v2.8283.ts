import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8283',
  date: '2026-11-22',
  title: 'Materials: a job with many box photos no longer crashes the phone that took them',
  kind: 'fix',
  highlights: [
    'A job’s Materials page reloaded over and over on the phone that took its box photos. That phone drew every photo whole. It now draws small pictures like every other phone.',
    'A photo filed in the job’s folder is read from the folder on every phone. The phone that took it no longer keeps its own copy.',
    'A photo still waiting on a phone stays on that phone. Send now and Share instead work as before.',
    'A box’s picture loads when the box is near the screen. A filed photo needs signal to show, now on the phone that took it too.',
  ],
}

export default note
