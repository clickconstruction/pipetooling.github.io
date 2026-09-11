import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3323',
  date: '2026-09-11',
  title: 'Cash App reconcile: import the export and see what was never recorded',
  kind: 'feature',
  highlights: [
    'Pay run gains a Cash App… button: upload the Cash App activity export as it comes; re-uploads only add what is new.',
    'Tie each Cash App name to a person once (or mark it not staff); proxy accounts are handled by a note rule.',
    'Every send to staff lands in a lane — Recorded, To review, Before records began, Not pay, Not staff — and the to-review list shows each send with its note and Cash App ID.',
    'Copy summary hands the whole picture to an agent as plain text.',
  ],
}

export default note
