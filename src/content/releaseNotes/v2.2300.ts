import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2300',
  date: '2026-08-25',
  title: 'Quickfill: move field photos into Google Drive',
  kind: 'feature',
  highlights: [
    'New "Field photos → Drive" section on Quickfill: every field write-up whose photos are still in app storage, oldest first.',
    'Download the photos, file them in the customer\'s Google Drive folder, paste the folder link — the link replaces the photos on the estimate and the card disappears.',
    'The estimate then shows "Field photos — moved to Google Drive" where the photo strip was.',
  ],
}

export default note
