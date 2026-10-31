import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6197',
  date: '2026-10-30',
  title: 'Empty cells on Supply Houses and a schedule block’s − and + read in both themes',
  kind: 'fix',
  highlights: [
    'On Supply Houses, the dash in an empty cell or an empty total is a quiet grey you can read, as empty cells are elsewhere. It was almost invisible.',
    'On Schedule & Dispatch, a block’s − (Remove block) and + (Copy block) read in dark mode. Light mode is unchanged.',
    'What everyone sees no longer counts a sort arrow that is hidden on purpose as text that is hard to read.',
  ],
}

export default note
