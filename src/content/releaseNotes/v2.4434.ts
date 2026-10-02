import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4434',
  date: '2026-10-02',
  title: 'Procurement log: tap a count to see which parts it means',
  kind: 'feature',
  highlights: [
    'On Bids → Submittals, the Before you can order box said "5 parts have no stage" without saying which parts.',
    'Each count is now a link. Tap "5 parts" and the log shows only those parts, by name, with no folds to open.',
    'Tap Show every line to bring the rest of the log back. Tick the 5 still works on the short list.',
    'When the last of them is fixed, the whole log comes back by itself.',
  ],
}

export default note
