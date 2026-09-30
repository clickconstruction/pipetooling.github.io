import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4208',
  date: '2026-09-30',
  title: 'Counts import: schedule rows are not counts',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Pasting a CountTooling export that carries a Duct or Water sizing block no longer turns its rows into count rows (a water main used to arrive as “Cold main × 1”).',
    'CountTooling now sends an alternate’s own water sizing under “Alternate: <name> · Water sizing”; the import reads it as the same alternate and skips the rows.',
  ],
}

export default note
