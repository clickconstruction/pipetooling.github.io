import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4862',
  date: '2026-10-07',
  title: 'People: the Hours grid and Teams tell archived people apart by who they are, not their name',
  kind: 'fix',
  highlights: [
    'The Hours grid and the Teams filter now check each person against the People roster by record, not by spelling.',
    'A pay row or team member still under an old name now leaves once that person is archived.',
    'A living person whose row carries an archived person’s name now stays on the grid and the team.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
