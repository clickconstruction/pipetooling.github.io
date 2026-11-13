import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7178',
  date: '2026-11-13',
  title: 'Materials on site: a box photo sent twice still lands',
  kind: 'fix',
  highlights: [
    'A box photo whose send reached the office, but whose answer was lost on the way back, could never be sent again. Every Send now was refused, and the photo never reached the job’s folder.',
    'Send now now sees that the photo is already there and finishes the job.',
    'A send that hangs stops after 30 seconds. The photo is kept on the phone for Send now.',
    'When the phone itself cannot keep a photo, the message says so and asks you to take it again. It used to say the photo was kept.',
  ],
}

export default note
