import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8680',
  date: '2026-11-26',
  title: 'Lien window: the developer can put a voided test record back',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'A voided lien record of a test job stayed voided for good. On a test job the developer now reads Voided records in the Lien window, with Put back… on each one.',
    'Put back makes the record live again. A notice or a lien paper that its void sent back to the Lien desk reads as sent again, tied to the record, on its old day.',
    'A record stays voided, and says why, when its paper has changed since the void, or when it was voided before the app kept what a void does to a paper.',
    'Nothing changes for the office. Void works as it did, and a real job’s records are never put back this way.',
  ],
}

export default note
