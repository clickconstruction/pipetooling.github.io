import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5883',
  date: '2026-10-26',
  title: 'The Monday sheet mails itself every Monday',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Every Monday at 6 AM Central the app builds the Monday sheet and mails it to every dev at their own address, and to nobody else. Turn it on from the Weekly email switch under the sheet. It ships off.',
    'The mailed sheet is the one the page shows, built from the same reads. When a read fails, the sheet says which one. The line under the switch says when it last went and to how many people.',
    'Email me this sheet still works, switch on or off.',
  ],
}

export default note
