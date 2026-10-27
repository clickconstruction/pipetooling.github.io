import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5958',
  date: '2026-10-26',
  title: 'A lien waiver from a bid is kept on the bid, and the leader signs it with his code',
  kind: 'feature',
  roles: ['estimator', 'assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'Bids → Lien Release now keeps every waiver that goes out on the bid. A print, a copy for email, a PDF or a signature each keeps one, listed under Already on this bid; click one to put it back on the page.',
    'An unconditional waiver held for the leader gains a card: "Malachi is with you?" with Sign with his code. He reads the waiver in a window on your screen and types his signing code, and the waiver is signed.',
    'Once his code signs it, the buttons come back and every copy carries his signature and its record. His phone hears that his code was used, naming the bid.',
    'Not with you? Ask him to send it himself says he sends it from the tab signed in as himself.',
  ],
}

export default note
