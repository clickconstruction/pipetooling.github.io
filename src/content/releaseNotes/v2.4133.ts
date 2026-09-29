import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4133',
  date: '2026-09-29',
  title: 'Procurement log: a first update marks nothing',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The first update you send prints every row plain — no amber dots and no “since” line under the rows, because there is no earlier update to compare with. The heading still says “first update”.',
    'Before this the first update printed “since :” with an empty date under each row.',
  ],
}

export default note
