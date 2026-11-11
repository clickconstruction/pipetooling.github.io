import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6903',
  date: '2026-11-10',
  title: 'Paste a price from a quote or a call, and it files itself on the right part',
  kind: 'feature',
  highlights: [
    'Takeoffs and the Parts Book have a new press, Paste a price. Paste a row from a quote or a mail and it finds the part on file by the supply house’s number, the model number or the words.',
    'One press files the price under that supply house. Undo puts the old price back.',
    'It asks before it files a price that moved more than a quarter, a price by the hundred, or a paper older than the price on file.',
    'A part’s prices now say where each came from, and offer A price from a quote or a call for that one part.',
  ],
}

export default note
