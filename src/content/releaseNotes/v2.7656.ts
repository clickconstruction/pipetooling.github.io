import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7656',
  date: '2026-11-17',
  title: 'Prospects: a card is free for the next caller as soon as you move on',
  kind: 'fix',
  highlights: [
    'When you move to another card, leave Follow Up, or finish a call with Not a fit, Can’t reach or a landing, your hold on that prospect is now let go at once.',
    'Before this, the hold was never let go, so a colleague did not see the prospect on their deck for up to 30 minutes.',
    'A hold left by a closed tab still clears by itself after 30 minutes.',
  ],
}

export default note
