import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3565',
  date: '2026-09-17',
  title: 'Bids → Labor: the driving and travel formulas are one tested kernel',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The Vehicle Travel and Lodging and Meals boxes computed their totals twice each — once for the collapsed line, once for the expanded body. Both now read one tested function, so a default can no longer drift between the two.',
  ],
}

export default note
