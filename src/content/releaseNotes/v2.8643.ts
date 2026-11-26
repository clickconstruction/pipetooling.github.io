import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8643',
  date: '2026-11-26',
  title: 'Task Mode on a phone: a task’s words get the width, and its presses sit under them',
  kind: 'fix',
  highlights: [
    'On a phone, a task under Then or Done today had its presses beside its words. Four presses left the words a narrow column that wrapped to many lines.',
    'Now the presses sit in a row of their own under the words, as they already do on the Next card.',
    'On a computer nothing changes, and every press is the one it was.',
  ],
}

export default note
