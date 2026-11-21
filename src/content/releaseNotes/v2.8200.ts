import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8200',
  date: '2026-11-21',
  title: 'A job shows its places as rows with photos, and reads the places an earlier job kept at the same address',
  kind: 'feature',
  highlights: [
    'A job’s window lists each place under the address as a row with its photo. Press a row to open the map on that place.',
    'A job now reads the places an earlier job kept at the same customer address, under a line named Kept at this address.',
    'So the tech on next year’s call sees where the cleanout and the shutoff are, without having been there.',
    'A job with no customer address picked shares nothing. Ask the office to pick it on the job.',
  ],
}

export default note
