import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4865',
  date: '2026-10-07',
  title: 'People: Offsets folds archived people by who they are, not their name',
  kind: 'fix',
  highlights: [
    'The Archived users section on Offsets now checks each person against the People roster by record.',
    'A person who shares a name with an archived duplicate now shows in the main list. The active count can go up by one.',
    'A person whose offsets are under an old name now folds once they are archived.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
