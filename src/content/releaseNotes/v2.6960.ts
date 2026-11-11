import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6960',
  date: '2026-11-11',
  title: 'Mark lost from a permit news line',
  kind: 'feature',
  highlights: [
    'On the Bid Board, a permit news line about a general plumbing permit under another name now has a second press, Mark lost…, once the bid has been sent.',
    'The press opens the window the board already uses to mark a bid lost, under the line: what they said, then the reason. A bid sent to several GCs lists them, and you mark the one that said no.',
    'Nothing is saved until you pick in that window. The news still marks no bid by itself.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
