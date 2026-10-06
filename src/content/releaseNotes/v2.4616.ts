import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4616',
  date: '2026-10-05',
  title: 'Legal portal: the Lien grid carries dates and dollars, nothing anyone said',
  kind: 'fix',
  highlights: [
    'The firm\'s Lien grid still shows every billed job with a lien month, but the rows behind it no longer carry the office\'s notes, hold reasons, the GC\'s word, owner emails or address notes.',
    'The function names the columns it sends and cuts every row again before it leaves, so the list cannot widen by accident.',
    'The portal\'s "What you cannot do" says plainly what the Lien grid is.',
  ],
}

export default note
