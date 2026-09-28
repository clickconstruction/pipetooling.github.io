import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4015',
  date: '2026-09-28',
  title: 'Edit Job: New Invoice can no longer turn into Ready to Bill as you press it',
  kind: 'fix',
  highlights: [
    'On a Working job, typing more than is left to bill and pressing New Invoice moved the job to Ready to Bill instead. Pressing the button cut the amount back to everything left, and everything left means “move the job” — so the button changed under your finger.',
    'Now that press does nothing, and a note says the amount was cut back and what each button would do. Press Ready to Bill if you meant to move the job, or type a smaller amount for an invoice.',
  ],
}

export default note
