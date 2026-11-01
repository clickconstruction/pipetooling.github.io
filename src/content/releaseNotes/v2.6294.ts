import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6294',
  date: '2026-11-01',
  title: 'Photos reach Drive again, and the job folder press works',
  kind: 'fix',
  highlights: [
    'Since the job folder update earlier today, photos stopped reaching Google Drive, the Make the job’s Drive folders press failed, and the Where files go tab on Documents would not load. All three work again.',
    'No photo was lost. Each one waited in the app, and the photo sweep files it into its job’s folder within a few minutes.',
    'The folder sweep that keeps every job’s folder under its customer now runs every ten minutes as planned.',
  ],
}

export default note
