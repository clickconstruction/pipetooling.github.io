import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7187',
  date: '2026-11-13',
  title: 'Lien window: the header names the step an affidavit is on',
  kind: 'fix',
  highlights: [
    'The Lien window’s Next on the path line now names the step an affidavit is on: Draft the affidavit, Approve the affidavit, or the fact that holds it, like Answer the homestead question. It said File the affidavit at every step.',
    'The Waiting on line beside it says what that step waits on: the draft, the leader’s approval, the owner of record, the GC’s address, a yes or a no on the homestead question.',
    'For an affidavit to draft, approve or take off hold, the button beside the line opens the Lien desk’s Affidavits list, where that work is done.',
    'This holds when the window is opened from a Pipeline row or from the Lien desk. The Lien desk’s own timeline reads the same.',
  ],
}

export default note
