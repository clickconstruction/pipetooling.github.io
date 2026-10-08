import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4948',
  date: '2026-10-08',
  title: 'Bids: a History button shows what changed on a bid',
  kind: 'feature',
  highlights: [
    'Every bid tab has a History button beside the bid’s name. It lists what changed on the bid, who changed it and when, newest first.',
    'An import of many rows is one line, like Imported 23 rows from CountTooling. Open a line to see each row.',
    'Pick a tab or a person, or search for a fixture or a value. A bid adopted into this one shows its changes too, marked with its number.',
  ],
  roles: ['estimator', 'master_technician', 'assistant', 'controller', 'primary', 'dev'],
}

export default note
