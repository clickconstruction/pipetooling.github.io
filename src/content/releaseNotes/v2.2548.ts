import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2548',
  date: '2026-08-31',
  title: 'Robot estimators can count symbols on scanned-style plans',
  kind: 'infra',
  highlights: [
    'New analysis toolkit lets the robot extract exact fixture and keynote counts from plan sets that have no searchable text — the kind where every symbol is drawn as raw lines.',
    'First live run counted every keynote callout on a real vet-hospital set (106 of 106 verified, zero misses) and caught a roof gas sheet the earlier review had skipped.',
  ],
}

export default note
