import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4166',
  date: '2026-09-29',
  title: 'Submittals: the page says what causes a Rev 2',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Under Build Rev 1 the line now reads: “Rev 1 is the first version of your submittal. A Rev 2 happens only when the GC sends rows back, or a product changes after you share.”',
    'Under Resubmit: “Rows the GC sent back come here. Start Rev 2 with only those rows, or with every row when a product changed.”',
  ],
}

export default note
