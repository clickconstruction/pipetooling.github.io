import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2447',
  date: '2026-08-28',
  title: 'The Pipeline partial-invoice modal shows what is really left to bill',
  kind: 'fix',
  highlights: [
    'The "Create partial invoice" modal on the Jobs Pipeline (the ⋯ menu\'s Partial invoice item on mobile cards) used to read "Remaining: $0.00" on any Ready-to-Bill job — and change whatever amount you typed to $0 — because it counted the automatic remainder draft as already billed. It now shows what is truly left, same as the Edit Job Bill tab.',
    'The Partial invoice menu item no longer disappears from Ready-to-Bill jobs that carry the automatic remainder draft.',
    'Typing the full remaining amount still opens Bill Customer instead of creating a partial, like before.',
  ],
}

export default note
