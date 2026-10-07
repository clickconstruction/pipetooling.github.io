import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4635',
  date: '2026-10-05',
  title: 'Legal portal: matters list largest balance first',
  kind: 'fix',
  highlights: [
    'The firm\'s portal lists its matters largest balance first, as the guide always said, and opens the largest by itself.',
    'When two balances match, the newest referral comes first.',
  ],
}

export default note
