import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4349',
  date: '2026-10-01',
  title: 'Pipeline: each bill row says what is paid and what is left on that bill',
  kind: 'feature',
  highlights: [
    'A job with two or more bills out shows one row for each bill. Each row now has a This bill line above its dates, like This bill · $11,182 paid · $589 left.',
    'A sent bill is no longer called a draft. Bills still in Ready to Bill keep their draft note.',
    'The mobile cards show the same line in the same place.',
  ],
}

export default note
