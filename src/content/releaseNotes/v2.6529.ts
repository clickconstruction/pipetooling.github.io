import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6529',
  date: '2026-11-04',
  title: 'People → Users counts the roster records still waiting for their users row',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When a roster record has no users row yet, a line above the filters says how many and shows them. Link account on each row joins it to its login.',
    'Combining two people who both have a users row now says where to go: the desk’s Merge a duplicate, which moves everything, the roster link included.',
  ],
}

export default note
