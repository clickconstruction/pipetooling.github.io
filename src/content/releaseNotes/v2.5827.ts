import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5827',
  date: '2026-10-24',
  title: 'Quickfill Email: the station shows the mail that sits in Gmail, not a list typed by hand',
  kind: 'feature',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'Once the owner turns counting on, the Email station shows each inbox you may see, with a row per label: how many threads sit there, how old the oldest is, and every thread older than the limit by name, with the day it came and a door into Gmail.',
    'A line says what came, what cleared and what is still there since the last look, and Looked saves the whole list as the mark’s note, with an optional word of your own. Read again counts the inboxes now.',
    'The station says what it counts and who sees it. A shared inbox shows to the office; your own shows to you and the lead. Until the app counts an inbox you can see, the station keeps its three boxes to type in.',
  ],
}

export default note
