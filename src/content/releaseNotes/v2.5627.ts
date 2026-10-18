import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5627',
  date: '2026-10-18',
  title: 'The Pipeline asks before it texts the customer when a job moves',
  kind: 'feature',
  highlights: [
    'Move a job forward to Working, Ready to Bill or Billed and Tell the customer can open over the board with the text ready: the work started, the work is done, the bill went to their email. Read it, change a word, press Send or Skip.',
    'Each of the three is its own switch on the homeowner flow in Settings → Flows, under The app and this move: Off or Asks. Everything starts Off. Only the owner or a dev changes it.',
    'A move back asks nothing. The crew’s moves ask nothing. The words come from the step’s line when the office has written one, else the app’s own.',
  ],
}

export default note
