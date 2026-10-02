import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4373',
  date: '2026-10-01',
  title: 'Approval PDF: a bid with versions prices the version you are on',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On a bid split into versions, the Approval PDF could price the version you are on with another version’s prices. Its Pricing page and its letter then read $0.00.',
    'It now takes the price the Pricing tab shows for that version. The margins on its first page list that version’s prices.',
    'Its letter page is the letter the Cover Letter tab shows: the same amount, with each alternate on a line under it, or one letter a page when you keep alternates on separate pages.',
  ],
}

export default note
