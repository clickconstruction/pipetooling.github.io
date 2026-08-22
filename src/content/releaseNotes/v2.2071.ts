import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2071',
  date: '2026-08-22',
  kind: 'fix',
  title: 'Goals strip: dropped the misleading "stage N of M" label',
  highlights: [
    'The label assumed stages finish in order ("1 done, so you\'re on stage 2") — wrong for roadmaps that run many stages in parallel. The numbered zones already tell the true story, so the label is gone.',
  ],
}

export default note
