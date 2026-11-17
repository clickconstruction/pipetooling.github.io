import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7498',
  date: '2026-11-16',
  title: 'Developer docs: the three shared docs hold one sentence a line, so two changes to one entry merge',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The glossary, the access control doc and the Lien desk map are written one sentence a line. The pages read the same as before.',
    'Two pull requests that change different sentences of one entry now merge. Before, each entry was one long line and the second pull request was dropped from the merge queue.',
    'A check refuses a line that holds two sentences or runs past its cap, so the long lines do not come back. One command splits them.',
    'Nothing in the app changed.',
  ],
}

export default note
