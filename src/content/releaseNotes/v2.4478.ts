import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4478',
  date: '2026-10-03',
  title: 'Submittals: Choose what the GC sees knows what is already approved',
  kind: 'fix',
  highlights: [
    'After a resubmit, a fixture the GC approved on the earlier revision opens locked in Choose what the GC sees. It reads Approved on Rev 3.',
    'Before, it opened lit GC sees it with Update live. One press asked the GC about it a second time.',
    'Ask again… puts it back on the draft when you mean to. Keep the approval takes that back.',
    'Under the rows, Left out no longer counts approved fixtures. They read 2 approved on Rev 3 beside it.',
  ],
}

export default note
