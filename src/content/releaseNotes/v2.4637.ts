import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4637',
  date: '2026-10-05',
  title: 'Legal: only approved clock sessions count as evidence',
  kind: 'fix',
  highlights: [
    'On the Legal desk, the firm\'s portal and both printed packets, hours, days worked and the lien dates count only approved clock sessions.',
    'Sessions nobody has approved yet show as awaiting approval, so a job no longer shows hours on one tab and no work day on the next.',
    'When a job\'s only sessions are waiting, the desk\'s note says to approve them in Hours before you refer the account.',
  ],
}

export default note
