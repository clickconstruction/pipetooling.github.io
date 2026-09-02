import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2570',
  date: '2026-09-01',
  kind: 'feature',
  title: 'Applying a payment to a bill is now one tap',
  highlights: [
    'An unapplied payment in Edit Job now shows the job\'s open bills as tappable chips right under the row — amount, when it went out, and what\'s still left on it — instead of a link into a hidden dropdown.',
    'The bill whose balance matches the payment is highlighted green and listed first.',
    'Two or more unapplied payments get a "Match payments…" bar above the table — place the whole backlog in one panel, with balances that update as you assign.',
    'Applied payments now say what they pay: "✓ pays the $4,720.00 bill · sent Aug 27".',
  ],
}

export default note
