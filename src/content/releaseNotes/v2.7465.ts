import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7465',
  date: '2026-11-16',
  title: 'Lien desk: the title is the first tab',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a computer the Lien desk’s title and its To do tab are now one press. The first tab reads ⏱ Lien desk · 32 to do, a little larger and heavier than the other three.',
    'Press it from any view to open To do with the Board in view. Press it on To do and the Board comes back up.',
    'The tab is blue while To do is the view. On By date, By paper and By job it keeps the desk’s name in dark words, so the page always says where you are.',
    'A phone is unchanged: the title keeps its own row and the first tab still reads To do · 32.',
  ],
}

export default note
