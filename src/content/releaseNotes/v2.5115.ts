import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5115',
  date: '2026-10-09',
  title: 'GC mode: closing out a trade and the job, in the database',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Once every line of a trade’s statement of work is billed and its punch list is done, we can accept their work.',
    'The trade’s final pay application asks for the retainage we hold, never less a back-charge taken off a draw. We approve it 10 days after the customer pays us ours.',
    'A change the trade signed on paper or by email can be recorded by the office. Then the job can be closed.',
    'Nothing on screen changes yet.',
  ],
}

export default note
