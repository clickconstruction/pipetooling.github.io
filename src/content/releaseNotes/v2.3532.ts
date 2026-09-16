import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3532',
  date: '2026-09-16',
  title: 'Pipeline: the ⋯ tools menu moves into its own file',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The Pipeline board\'s ⋯ menu — sort, filters, Lien desk, Contract sweep, Job Book, the toggles — now lives in its own component with its own tests, so the board file is smaller and the menu can be changed without touching the rest.',
  ],
}

export default note
