import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6898',
  date: '2026-11-10',
  title: 'Add Part says when the part is already in the book',
  kind: 'feature',
  highlights: [
    'Type a name on the Add Part form and it checks the parts book as you type. If the part is on file, it says so and shows it.',
    'It knows a model number however it is typed. Z8702-9B-PC, Z87029BPC and Z8702 9B PC are one number.',
    'Press Use that part and the part on file goes where the new one would have gone. Nothing is made twice.',
    'It never warns for another size of a part, and Mine is different puts it away.',
  ],
}

export default note
