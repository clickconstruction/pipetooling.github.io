import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4867',
  date: '2026-10-07',
  title: 'People: Contracts lists archived people by who they are, not their name',
  kind: 'fix',
  highlights: [
    'Contracts now checks each person and each app account against the People roster by record.',
    'A person who shares a name with an archived duplicate now shows in the main list. The active count can go up by one.',
    'A roster person whose app account is archived still moves to the Archived group.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
