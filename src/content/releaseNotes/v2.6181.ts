import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6181',
  date: '2026-10-30',
  title: 'The sorting and the words under the robot fixtures window',
  kind: 'feature',
  highlights: [
    'The rules the robot fixtures window will follow are written and tested: how a robot fixture finds the row of yours it matches, by its tag first and never by a guess, which rows start ticked, and what the button and the line under it say.',
    'The seven stops of a bid with the robots, from Plans filed to Scored, and the one sentence each stop prints, so the Counts tab and the Robot status sheet will read the same words.',
    'Nothing shows on a bid yet. The window, the shaded rows and the stage line come in the next releases.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
