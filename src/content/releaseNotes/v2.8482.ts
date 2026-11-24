import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8482',
  date: '2026-11-24',
  title: 'The app’s code check has room again, and says so when it runs out',
  kind: 'infra',
  highlights: [
    'Before each update goes out, a check reads all of the app’s code. The app had grown to fill the memory that check was given, and one more day of changes would have stopped updates.',
    'The check now takes its memory from the machine it runs on, so it has room wherever the machine has room.',
    'A check that runs out of memory now says in one line that it gave no answer, so a stopped check is no longer read as a clean one.',
    'This buys about a week at the pace the app grows. The lasting fix, checking the app in parts, is on the punch list.',
  ],
}

export default note
