import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2402',
  date: '2026-08-27',
  title: 'Workbench: quieter solve chip',
  kind: 'fix',
  highlights: [
    'The chip under the totals now says just "95% on 15 costed rows" — in the solver\'s blue, tucked right under Revenue / Profit / Margin.',
    'It no longer restates the bid total and margin that sit directly above it.',
  ],
}

export default note
