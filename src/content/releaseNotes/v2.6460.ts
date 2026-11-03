import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6460',
  date: '2026-11-03',
  title: 'A combine names the Lien desk draft it sets aside on the combined job activity',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When both jobs hold a live Lien desk draft of the same kind, a combine keeps the target draft and sets the source draft aside. The combined job activity now gets a Combined line that names that draft and its months.',
    'The Lien desk does not list a draft that was set aside. Nothing it tracks goes with it, because the desk works out the months a notice is due from the job bills and work.',
    'The combine guide said the desk still lists such a draft. That was wrong, and the guide now says what happens. A dev can bring a set-aside draft back.',
  ],
}

export default note
