import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6626',
  date: '2026-11-07',
  title: 'A teammate’s goal: the license they work toward, the board’s number, and the hours before the clock',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'primary', 'helpers', 'superintendent'],
  highlights: [
    'People → Licenses: under a teammate’s licenses, a Goals block names the next license in each trade and the hours the board asks for. Press Set the goal to pick the license and type the board’s own number, or leave the ladder’s rule.',
    'Hours a teammate worked before the clock started go in once, with where they came from. The logbook, Your week and the Monday email count them from then on.',
    'The logbook’s goal card says Includes 1,200 hours before the clock started and offers Edit the goal to the office. A teammate sees the same line on My logbook.',
    'A journeyman electrician’s next rung had no rule seeded. Set the goal names the master license and its hours, and the card appears.',
  ],
}

export default note
