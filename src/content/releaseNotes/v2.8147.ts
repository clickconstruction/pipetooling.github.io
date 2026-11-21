import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8147',
  date: '2026-11-20',
  title: 'Permits: a customer tied to a name adds only the bids the rest of the page counts',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When a name on the permits is tied to one of our customers, that customer’s bids count for the name. They are now the bids of the last two years, and no practice bid is among them.',
    'So Builders, the call list’s We bid tag and the table of companies all read one count for one company.',
  ],
}

export default note
