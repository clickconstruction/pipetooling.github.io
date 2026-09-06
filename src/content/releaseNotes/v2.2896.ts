import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2896',
  date: '2026-09-05',
  title: 'Every card says the same number as the page it opens',
  kind: 'fix',
  highlights: [
    'Needs You "N purchases need a job" and Job Parts Tally now read from the same two counts. The card says how many are unlinked in all, and the tally header says how many are over the age floor — the card\'s number — so "100 need a job" opening "105 unlinked" reads as one pile described two ways, not two answers.',
    'The Division 22 codes modal counts names the way the Dashboard card does — "WC-1" and "wc-1" are one name (rules match without regard to case), shown once with "also spelled …" beside it. The card and the modal now say the same uncoded count.',
    'The lost-bids card says its count covers every trade and that the Why we lost lens opens on one trade, so a card saying 60 above a lens saying 59 is scope, not a wrong number.',
    'Quickfill\'s collapsed Dispatch inbox strip shows "N open" instead of "—". On the Person tab rail, "N contracts never sent" uses the same words as the Users-tab chip for the same count.',
  ],
}

export default note
