import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8400',
  date: '2026-11-23',
  title: 'Permits: the nightly pull keeps where each reading started',
  kind: 'infra',
  highlights: [
    'Behind the scenes only. The record of each nightly permit pull now keeps where San Antonio’s second reading, by issued day, started, and whether it read to its end. The next change uses it so a run of failed readings cannot skip a month of issued permits.',
  ],
}

export default note
