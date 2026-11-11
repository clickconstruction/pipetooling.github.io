import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6911',
  date: '2026-11-10',
  title: 'One press files every ready row of a price sheet',
  kind: 'feature',
  highlights: [
    'A price sheet now has one press at the top. It says how many rows it files and how many wait, and it files only what is ready.',
    'Rows matched by a model number can be confirmed together after one look.',
    'A row with no price of its own still teaches the supply house’s number, so the next sheet asks less.',
    'Take this sheet back returns every price the sheet filed to what it was. A price changed since is left alone.',
  ],
}

export default note
