import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2982',
  date: '2026-09-06',
  title: 'Safety net under the cost-estimate print page',
  kind: 'infra',
  highlights: [
    'Nothing changes in the app. The Labor tab\'s cost-estimate print page — labor hours and totals, the materials list per fixture, the three stage POs, driving and travel and estimator costs, the grand total — now has 14 tests pinning the numbers it prints and where it reads them from.',
  ],
}

export default note
