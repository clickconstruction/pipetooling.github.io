import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5215',
  date: '2026-10-10',
  title: 'GC mode: work through everyone we wait on, one person at a time',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Work the list on Follow up and on a board row opens the Follow up sheet: one person at a time, with what they owe ticked.',
    'It drafts a polite text or email that opens in your own Messages or mail. Press I sent it and it is logged.',
    'Call logs what they said. A day they gave for a paper is kept as their promise.',
    'Follow up now ends with More to follow up on: papers, plans not opened, the schedule, the architect and customers.',
  ],
}

export default note
