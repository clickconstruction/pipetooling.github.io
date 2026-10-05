import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4525',
  date: '2026-10-04',
  title: 'Pipeline: the automatic checks read the new section headers',
  kind: 'infra',
  highlights: [
    'The checks that open Pipeline after every update had failed since the section headers got their color bands.',
    'They waited for the old header wording, which the page no longer draws. They now read the count on the Working header.',
    'Nothing changes on your screen.',
  ],
}

export default note
