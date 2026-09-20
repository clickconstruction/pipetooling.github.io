import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3647',
  date: '2026-09-20',
  title: 'Contracts: Edit & re-send — fix an agreement the customer has not opened yet, without voiding it',
  kind: 'feature',
  highlights: [
    'Sent an agreement with the wrong amount or a typo? If the customer has not opened it, the contract window now has Edit & re-send: the same agreement unlocks right there as the next revision, you fix it, and it goes out again on the link they already have.',
    'It asks first and says what they may be holding — nothing yet, or the earlier PDF in their inbox — and the link shows nothing while you are editing.',
    'Once they have opened it the button is gone and the window says why: what they read stays on the record, and Void & redo is the way, as before. The same goes for a page already handed over on paper.',
    'No more pile of voided copies behind one job — one job collected three in a day before this.',
  ],
}

export default note
