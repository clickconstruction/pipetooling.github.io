import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5338',
  date: '2026-10-12',
  title: "Messages: a trade partner's draw reads as ours until we pay it",
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Once a trade partner asks for a draw, its step reads as ours until we pay it, on their page and on the card.',
    'Between draws, the next pay application reads as theirs to send.',
    'An office edit to the trade flow’s draws step stays as the office made it.',
  ],
}

export default note
