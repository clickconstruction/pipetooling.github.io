import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7899',
  date: '2026-11-18',
  title: 'Lien desk: the list’s heading says what it counts',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On a computer, the red heading over the To do list now reads like Needs you now · 27 papers. It read a bare 27.',
    'Beside it a grey line says how many more wait under Later, like 12 more under Later.',
    'The heading counts papers, as the bins do. The first tab still counts the rows you can move, so the two numbers can differ.',
  ],
}

export default note
