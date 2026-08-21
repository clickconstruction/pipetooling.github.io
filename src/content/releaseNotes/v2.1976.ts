import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.1976',
  date: '2026-08-21',
  title: 'Edit jobs right from GC Review',
  kind: 'feature',
  highlights: [
    'Every job in the GC Review report is now clickable — Edit Job opens on top of the report, so you can set a missing GC/Builder (or fix anything else) without leaving it.',
    'When you save, the report refreshes in place: the job moves to its GC\'s group immediately.',
  ],
}

export default note
