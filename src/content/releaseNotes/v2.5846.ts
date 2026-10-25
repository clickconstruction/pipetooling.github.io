import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5846',
  date: '2026-10-25',
  title: 'Legal desk documents: the day the paper is from, and draft, sent or received',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'A document for the firm now carries the day the paper is from. The Timeline places it there and says when it was added, so a contract signed in May sits in May, not on the day it was uploaded.',
    'Each document has a state: draft, final, sent or received. A draft wears a Draft chip on the desk and the firm’s portal, and the firm sees drafts on purpose. Mark sent… records the day, how, to whom and the proof, such as the mailing receipt once it is on the matter; Received… records the day a paper came in.',
    'The firm’s Evidence table and the printed packet read the same state and days.',
  ],
}

export default note
