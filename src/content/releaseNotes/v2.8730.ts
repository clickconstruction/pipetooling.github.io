import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8730',
  date: '2026-11-27',
  title: 'HR files: a correction link is written through the HR door',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'On People → HR, linking an entry to what it corrects or completes used to write the links table directly. So did taking a link off.',
    'Both now go through the same dev-only door the dev seat writes through. The screen, its presses and its words are as they were.',
    'A link still names who made it and who took it off. The door reads that from your sign-in.',
    'This is the first of two steps. The second takes away the direct way in, once every open tab runs this version.',
  ],
}

export default note
