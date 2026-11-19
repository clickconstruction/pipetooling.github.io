import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7843',
  date: '2026-11-18',
  title: 'The sub’s page says when the customer paid',
  kind: 'feature',
  highlights: [
    'A sheet waiting on the customer now reads Customer paid, with the day, once the bill it rides on is paid in full. It shows no amount.',
    'The page says their payment is next. A hold’s reason shows right under that sentence. The words are in English and Spanish.',
    'The sheet’s row on Jobs → Subs → Pay says what the sub reads. It turns amber when a paid sheet has had no payable-after date for more than two days.',
    'A sheet with no bill tied, and a bill paid only in part, read as they did before.',
  ],
}

export default note
