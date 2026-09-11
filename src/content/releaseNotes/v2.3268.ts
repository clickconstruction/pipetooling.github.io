import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3268',
  date: '2026-09-11',
  title: 'Add a discount from the bill itself',
  kind: 'feature',
  highlights: [
    'In Bill Customer, press − Add discount by the amount. Type what you agreed in your own words: take off 10% or 500, or make this bill 13,500 — and a sentence tells you what happens and the new amount.',
    'A draw discounts its own lines; the whole-job bill discounts every line. One link flips a draw\'s discount to the whole job, and the sentence says how much of it rides this bill.',
    'Apply writes the same discount row the Bill tab uses, updates the bill and the previews in place, and leaves the trail — no need to leave the modal.',
  ],
}

export default note
