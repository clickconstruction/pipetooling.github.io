import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8339',
  date: '2026-11-23',
  title: 'Dashboard: the Lien desk is a card of its own beside Needs you',
  kind: 'feature',
  highlights: [
    'The Lien desk’s counts are no longer a box inside the Needs you card. They are a slim card of their own, right above it. Needs you now starts with its title and holds only things to press.',
    'The card shows three counts side by side: how many papers are due by the next lien day, how many wait on the leader, and how many wait to print and mail. The Board is always on the top line, at the right.',
    'A red line shows only while a paper is past its day or will not make it. It uses the same words as the Board, so the Dashboard and the Lien desk agree.',
    'A leader reads wait on you, the same word his lien rows use. The unpaid amount is on the Board and no longer on the Dashboard.',
  ],
}

export default note
