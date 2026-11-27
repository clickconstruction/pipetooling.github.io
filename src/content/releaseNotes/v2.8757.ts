import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8757',
  date: '2026-11-27',
  title: 'The list of roles gets its own home in the code, so the lower layers stop reading the sign-in code',
  kind: 'infra',
  highlights: [
    'Behind the scenes only. Nothing on any screen changes, and no role can do more or less than before.',
    'The app’s code is being sorted into layers so its code check can read one layer at a time and hold less memory.',
    '92 files in the lowest layer read the list of roles from the sign-in code above them. The list now has a home of its own, and those files read it there.',
    'The list of reads that still cross layers fell from 232 to 140.',
  ],
}

export default note
