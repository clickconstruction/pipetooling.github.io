import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7730',
  date: '2026-11-17',
  title: 'Bids: the Price window and the Another price window are their own pieces',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Behind the scenes, two small windows on the Pricing tab moved out of the big Pricing file: the one that renames or deletes a price, and the one that names another price for a GC.',
    'Each has its own tests now, and the rule that keeps a price a GC’s letter is built on from being deleted is tested by itself.',
    'Nothing changes on screen.',
  ],
}

export default note
