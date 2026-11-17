import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7562',
  date: '2026-11-17',
  title: 'Dashboard and Bridge: a supply house bill paid in part counts what is left',
  kind: 'fix',
  highlights: [
    'Accounts payable on the Dashboard counts what is left on a supply house bill paid in part, not its whole amount. It now agrees with the total on Materials.',
    'In the card\'s window the bill shows what is left, and a line under it says what was paid, as in "$300.00 paid · $512.40 left of $812.40".',
    'The Bridge follows: owed by you, the supply bills due in the cash forecast and the bills behind Ask the supply houses for more days all count what is left.',
    'The Bridge\'s net position lowers what is owed on the day each part was paid. Before, a bill showed nothing until its last part, then all of it on that day.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
