import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3009',
  date: '2026-09-07',
  title: 'Edit customer, refreshed: contacts and properties in one place',
  kind: 'feature',
  highlights: [
    'Two columns: the customer\'s details on the left; Contacts and Properties on the right. Each contact reads as a person with a role; each property shows its county, whether it is lien-ready, and how many jobs sit there. Click Edit to open either in place.',
    'Properties know about your jobs: any job address not saved as a property shows as a one-click "Add as property" row, and the legal record is looked up the moment an address is picked.',
    'The Address field is gone — the ★ property is the address. Click ☆ on another property to make it the primary.',
    'Contacts and properties save as you go; Save covers the details on the left.',
  ],
}

export default note
