import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4234',
  date: '2026-09-30',
  title: 'Audits: a queue on the left, the open card on the right',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Bids → Robots → Audits is a queue: Now (the open card), Up next in the order your verdict unblocks, Opens when you send (the sealed shadows, folded, with the due date of the bid each waits on), Digesting and Digested.',
    'Rows are named for the job — MPH Casa Linda, not “b476 · ZZ Twin MPH CASA LINDA (backtest R2)” — with the delta as the one number and a why line: questions, notes, the kind of job and how many in a row it has, “needs a fix first”, and which slate it came from.',
    'On a wide screen the queue sits on the left and the open card on the right, always at the top, so a tap opens a card without scrolling. On a phone a row opens the card full-screen, with Finish → next at the bottom.',
    'The Finish audit button says what opens next.',
  ],
}

export default note
