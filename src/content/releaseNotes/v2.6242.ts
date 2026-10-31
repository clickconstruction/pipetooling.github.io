import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6242',
  date: '2026-10-31',
  title: 'Undo on robot fixtures says what it took back',
  kind: 'fix',
  highlights: [
    'After you press Undo on the robot fixtures toast, the message now says what that Undo did, such as 1 fixture taken back or 1 row back to your number. Before, it said the robot’s rows were all off your count, even though the fixtures you added earlier stayed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
