import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3713',
  date: '2026-09-22',
  title: 'Contract sweep: the save word sits with what you type, and the tabs never clip',
  kind: 'fix',
  highlights: [
    'The pane’s “saves to the job’s draft as you type” line sat under the Amount, which is the one thing you cannot type. It now sits on the This job heading, over the scope and the payment line it is about, and says so.',
    'The list’s tabs — In Drive, Ready to send, Needs a look, All — wrap into two rows when the column is narrow instead of cutting the last one off.',
  ],
}

export default note
