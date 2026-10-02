import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4386',
  date: '2026-10-02',
  title: 'Procurement log: To order folds by house, and cards on a phone',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'To order folds the lines waiting on the GC to one line per house, like Moore Supply · 22 parts. Tap a house to see its parts.',
    'A row with no product yet is named in Before you can order, with Open it.',
    'On a phone or a narrow screen each part is a short card: the part, then its qty, house, stage and lead time, and its status. Nothing scrolls sideways.',
  ],
}

export default note
