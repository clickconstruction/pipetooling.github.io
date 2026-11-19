import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7835',
  date: '2026-11-18',
  title: 'Subs: a sheet waiting on the customer is tied to one bill',
  kind: 'feature',
  highlights: [
    'Moving a sheet to Waiting on customer now ties it to the bill it waits on. A job with one open bill is tied by itself.',
    'A job with several open bills asks Which bill does this sheet ride on? You pick the bill, or No bill, and press Request the draw.',
    'The sheet’s row on Jobs → Subs → Pay says which bill it rides on. Press that line to pick the bill, change it or clear it.',
    'The sub’s page does not change yet. This is the first of three steps toward the page saying the customer paid.',
  ],
}

export default note
