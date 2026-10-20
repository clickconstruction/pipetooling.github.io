import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5601',
  date: '2026-10-17',
  title: 'Prospects: the person we call comes first, and a homeowner is a person',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'New Prospect and Edit prospect now ask for the person first: their name, title, cell, email, language, and whether we may text them. The company sits under them, and an owner who is a person on their own leaves it empty.',
    'The card names the person with their title and language, dials their cell first, and shows the office line beside it. Language is on every kind of prospect now, not subs alone.',
  ],
}

export default note
