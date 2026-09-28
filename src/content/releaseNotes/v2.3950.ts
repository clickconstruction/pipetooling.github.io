import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3950',
  date: '2026-09-27',
  title: 'GC Review: one list for the week, worked by whoever is at the keyboard',
  kind: 'feature',
  highlights: [
    'GC Review now opens on This week’s GCs: every GC with a balance, with three steps on each row — Check the bills, Send the statement, write down the Word. It replaces the Weekly statement rounds panel, which handed each GC to its sender and waited.',
    'The GCs are grouped by the account man who knows them (“Ask Malachi · 7 GCs”), so one call covers the group. Whoever is signed in can work every row.',
    'The statement and the word can be recorded in either order. Sending after you wrote down the word keeps the word; writing the word after sending keeps the day the statement went out.',
    'The strip at the top counts all three: checked, sent, and words in.',
  ],
}

export default note
