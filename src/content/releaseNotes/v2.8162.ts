import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8162',
  date: '2026-11-21',
  title: 'Papers: a supply house and a customer each list their own papers',
  kind: 'feature',
  highlights: [
    'A supply house’s window has a Papers section. It lists every paper that is with the house or one of its contacts.',
    'The Customer page’s Agreements card lists the papers that are with the customer, beside the job contracts.',
    'Each line says the kind of paper, who signs and where it stands. A W-9 and a paper that was never sent are listed too.',
    'An estimator reads these lists for an outside company, and opens a signed paper from its name.',
  ],
}

export default note
