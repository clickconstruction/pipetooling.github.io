import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8113',
  date: '2026-11-20',
  title: 'Job Mode: This week counts the day you just worked',
  kind: 'fix',
  highlights: [
    'In Job Mode, the This week square now counts today as soon as you clock out.',
    'Before, it kept the hours from when you opened the app, so it read a day short until the page was opened again.',
    'The hours card lower on the page was short the same way, and My Time’s Your hours line on the full Dashboard too. All three now read again when you clock in or out.',
  ],
}

export default note
