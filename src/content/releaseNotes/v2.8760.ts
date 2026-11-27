import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8760',
  date: '2026-11-27',
  title: 'A new task on a phone: the “new version” bar no longer covers Send',
  kind: 'fix',
  highlights: [
    'On a phone, the bar that says “A new version is ready.” came up over the foot of a task window and covered Tell me and the send button.',
    'While a task window is open the bar now sits at the top of the screen, so the task and its send button stay clear.',
    'It covers the window’s title until you press Not now or Reload. At a desk nothing changes.',
  ],
}

export default note
