import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5816',
  date: '2026-10-24',
  title: 'Quickfill Texts: the station reads Messages instead of asking for a note',
  kind: 'feature',
  roles: ['assistant', 'controller', 'estimator', 'master_technician', 'dev'],
  highlights: [
    'Quickfill’s Texts station now shows the day’s texts from Messages: the texts nobody has answered, longest waiting first, with Reply and Call; our texts from today and yesterday that never reached a phone, red, with Call them; and every text that went out today with Quo’s mark, folded until you press Show. A row opens the thread on Messages.',
    'The station’s count is the work: texts needing a reply plus texts not delivered. On a clean day it reads one line, Nothing on texts is waiting on us, and the Mark is one press.',
    'The Mark no longer asks for a note. It writes one from the rows, who was still waiting and what went out, so the history says what each look found. Anything else? keeps one line for a text the app cannot see.',
    'The banner asks what the rows answer: Is anything on texts still waiting on us? In the round and the Roller the foot’s Looked marks the station like every other one. Texts the app prepared still live on Today’s sends; the station points at them.',
  ],
}

export default note
