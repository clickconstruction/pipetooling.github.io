import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3351',
  date: '2026-09-11',
  title: 'The firm\'s mailer no longer saves up unheard events',
  kind: 'fix',
  highlights: [
    'When nobody at the law firm has confirmed an email yet, releases, answers, and pull-backs were held in the queue and the first person to confirm would have received every one of them at once. An event is now heard by whoever is subscribed when it happens and is never replayed to someone who joins later.',
    'Same rule for the weekly digest: with no digest people at the firm, the digest lane is consumed as events arrive.',
  ],
}

export default note
