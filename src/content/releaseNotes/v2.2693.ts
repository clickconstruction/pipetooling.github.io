import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2693',
  date: '2026-09-03',
  title: 'Contract modal says "Link copied" when nothing was emailed',
  kind: 'fix',
  highlights: [
    'After Copy link or Sign in person, the Contract modal’s strip now reads "Link copied — nothing emailed yet" and offers Send by email, instead of claiming the contract was sent to the customer.',
  ],
}

export default note
