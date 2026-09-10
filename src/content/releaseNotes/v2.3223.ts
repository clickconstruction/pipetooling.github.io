import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3223',
  date: '2026-09-10',
  title: 'Robot needs sheet: "Attached — rerun" now asks for the rerun',
  kind: 'feature',
  highlights: [
    'When a robot asked for a different plan set and you fix it, tapping Attached — rerun on the robot needs sheet answers the robot and moves that bid to the front of the next robot batch, the same as the green robot icon. Before, it only saved the answer.',
    'The other two taps, Use what is on the bid and Skip this bid, answer without asking for a rerun.',
  ],
}

export default note
