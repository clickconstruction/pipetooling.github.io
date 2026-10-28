import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6033',
  date: '2026-10-28',
  title: 'Push me: the line reads "Pushed every day" in one case',
  kind: 'fix',
  highlights: [
    'When every day is on, the line under Push me read "Pushed Every day, 6:00 AM to 8:00 PM." with a capital E in the middle of the sentence. It now reads "Pushed every day, 6:00 AM to 8:00 PM."',
  ],
}

export default note
