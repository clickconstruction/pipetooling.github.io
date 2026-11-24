import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8402',
  date: '2026-11-23',
  title: 'Permits: a failed nightly reading can no longer skip issued permits',
  kind: 'fix',
  highlights: [
    'San Antonio’s applications are read twice a night, the second time by the day each permit was issued.',
    'If that second reading fails, the next night now starts where the failed one started. Before, a month of failures could skip the permits issued in that month, and they read as still waiting.',
  ],
}

export default note
