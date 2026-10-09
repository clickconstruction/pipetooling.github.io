import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5041',
  date: '2026-10-09',
  title: 'GC mode: a trade partner’s papers, in the database',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A trade partner company’s master agreement, W-9 and insurance certificate can now be kept as the company’s own papers.',
    'Each paper sent to a company is kept with the day it is due, and Follow up holds the promise.',
    'A company’s master agreement or W-9 goes by email to the people it named for contracts, with a link to read and sign it.',
    'Nothing on screen changes yet.',
  ],
}

export default note
