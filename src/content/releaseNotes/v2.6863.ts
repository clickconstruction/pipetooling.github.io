import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6863',
  date: '2026-11-10',
  title: 'People → Users: the people who are away read as part of the roster',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Away is now a group of roster rows under a heading like every other group, in place of the boxed table.',
    'Each row gives the day they left and the day back in plain words, such as "back Nov 8, 2029, in 3 years". A bell shows when you asked to be told on the day.',
    'The second line shows the first line of the note they will read, and ends in See what they see.',
    'Edit the note… and Bring back… are in the row\'s ⋯ menu. On the day back the row turns amber and Bring back… comes out onto the row.',
  ],
}

export default note
