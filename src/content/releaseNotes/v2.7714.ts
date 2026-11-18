import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7714',
  date: '2026-11-17',
  title: 'Lien desk: the Board marks the bins with something to do now, and folds the empty ones (punch list #383)',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A bin whose own press is ready has a blue left edge. The blue border on the busiest bin is gone, since it marked the most papers and read as the most urgent.',
    'A bin with no paper is one quiet line with a zero, so the whole chart is shorter.',
    'Held and Missed stand on each column’s heading line, at its right. Every bin now has the column’s full width.',
    'The affidavits’ To send for Master approval bin has a press, like Send 5 for approval. It opens the affidavits list where one press sends them.',
  ],
}

export default note
