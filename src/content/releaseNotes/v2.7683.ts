import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7683',
  date: '2026-11-17',
  title: 'Legal desk: copy a letter straight into an email',
  kind: 'feature',
  highlights: [
    'On a matter\'s Evidence tab, press Read on a letter kept as text. Copy the letter now sits over the words. It puts the letter on the clipboard as plain text, ready to paste into an email.',
    'The copy leaves out the draft note at the top and any section whose heading starts with INTERNAL. A line over the words says what was left out.',
    'A blank in square brackets, such as [DATE], stays as written. The desk lists every blank still to fill, and the copied message counts them.',
    'A document with more than one letter gets a press for each, named by its heading. Copy everything as text takes the whole document. The HR file\'s documents gained the same Copy the letter press.',
  ],
}

export default note
