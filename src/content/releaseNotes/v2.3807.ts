import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3807',
  date: '2026-09-24',
  title: 'A retired punch-list number stays retired',
  kind: 'fix',
  highlights: [
    'The to-do check now hands out the next punch-list number from the highest ever assigned, not the highest still on the board — so retiring the newest to-do (#41, the Lien desk) no longer offers #41 to the next one.',
    'It reads the numbers from three places: the to-dos folder, the release fragments that cite a punch-list number, and every number a to-do carried in git history.',
  ],
}

export default note
