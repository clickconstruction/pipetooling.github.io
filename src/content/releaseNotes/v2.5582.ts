import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5582',
  date: '2026-10-16',
  title: 'Prospects: Escape closes an untouched New Prospect, and a touched one asks',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'New Prospect and Edit prospect close on Escape or a press outside them while nothing has changed.',
    'Once something has been typed, either way out asks Leave without saving? with Keep editing, instead of throwing the typing away.',
  ],
}

export default note
