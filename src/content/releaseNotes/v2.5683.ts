import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5683',
  date: '2026-10-20',
  title: 'Estimates: a sent estimate shows What went',
  kind: 'feature',
  highlights: [
    'After a send, the sheet’s receipt closed and nothing on the estimate said what actually reached the customer.',
    'A sent estimate now keeps a What went card: the email with its time, and each text that carried the estimate link, with Open the thread.',
    'When no text went, the card says why: no phone number on file, their number sent STOP, or simply that none was sent yet.',
  ],
}

export default note
