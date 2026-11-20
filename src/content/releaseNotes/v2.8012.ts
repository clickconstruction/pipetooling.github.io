import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8012',
  date: '2026-11-19',
  title: 'Before we start: Go or hold, with a name on the decision',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'superintendent'],
  highlights: [
    'An open stage has a Go or hold press. Go sends the crew for our first day, and your name and the day are kept with it.',
    'A Go with something still open is a go on their promise. It comes back to you the day before the crew leaves.',
    'Hold keeps the crew home and moves our start to the day you pick. It writes the note for the customer, and you send it.',
    'Nothing is blocked. A crew can still be scheduled with no Go, and a Go can be taken back.',
  ],
}

export default note
