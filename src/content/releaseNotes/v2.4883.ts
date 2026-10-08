import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4883',
  date: '2026-10-07',
  title: 'AIA G702-G703: put a deleted pay application back',
  kind: 'feature',
  highlights: [
    'A deleted pay application now has a Put it back button, in the window\'s history and on the job\'s Documents tab. It comes back live with its amounts, its workbooks and who saved it.',
    'When another application now has its number, the window says so and what to do first.',
    'Deleting the last application now lands on the history, so the undo is right there.',
  ],
}

export default note
