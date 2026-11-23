import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8359',
  date: '2026-11-23',
  title: 'On a phone, a toast shows at the foot of the screen',
  kind: 'fix',
  highlights: [
    'A short message after a press, like Saved or Sent, used to show at the top of a phone screen, over the heading of the card under it, for as long as it stayed up.',
    'It now shows at the foot of the screen, above the tab bar and the Job Mode press bar, where no heading is.',
    'On a desktop nothing moves: the message still shows top-right, under the header.',
  ],
}

export default note
