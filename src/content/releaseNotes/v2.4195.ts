import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4195',
  date: '2026-09-29',
  title: 'Cover Letter: the alternate priced in addition to the proposal',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When a bid carries an alternate, the letter’s proposed amount is the base, and a block under it — “Alternates — priced in addition to the proposal above” — prices each one as “add $X (with it, $Y)” with the fixtures it covers.',
    'Under In this cover letter, each alternate gets an Offer checkbox and click-to-edit wording. Untick it and its price folds back into the proposal.',
    'Marking the bid sent stamps the base as the Bid value, and the Bid Board shows a small “+$X alt” beside it so the alternate is never lost.',
    'This completes the alternates work: count it as a group in CountTooling, and Counts, Takeoffs, Labor, Pricing and the letter all price the bid with and without it.',
  ],
}

export default note
