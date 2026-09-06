import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2907',
  date: '2026-09-05',
  title: 'Globes show their state, new portal addresses get a tail, a thumb-sized Approve',
  kind: 'fix',
  highlights: [
    'The portal globe next to a customer or a sub now tells you at a glance who has a portal: faint grey means no link has ever been created, blue means their portal is live, red still means it was turned off. Hover it for the words. Both globes use the same colours.',
    'A new portal address now starts as their name plus a short random tail — my.clickplumbing.com/knight-contracting-x7kq — so nobody can open a statement by guessing our short address and a customer\'s name. A 🎲 beside the address rolls a new tail, and the guess meter now says why it graded the way it did ("it\'s just their name"). Addresses already saved are untouched.',
    'On the estimate acceptance page, the Approve and Submit buttons are now thumb-sized on a phone (at least 44 px tall) instead of 34 px.',
    'On an estimate draft, the step rail and the Pipeline list now count the same lines: the seeded $0 "Custom Service Visit" placeholder no longer ticks "Line items" on the rail while the list still says "1 left: cost lines".',
  ],
}

export default note
