import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5050',
  date: '2026-10-09',
  title: 'GC mode: the presses behind RFIs and the change order they start',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'GC mode can keep the questions a job raises while we build: each RFI gets its number and the work it holds, and each send and answer is kept.',
    'An answer that adds cost can start a change order for the money team, linked to its RFI. Nothing on screen uses this yet; the RFIs window comes next.',
  ],
}

export default note
