import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6236',
  date: '2026-10-31',
  title: 'Where a bid stands with the robots, in seven stops',
  kind: 'feature',
  highlights: [
    'The Counts tab shows one line beside the bid flow: Robot, then where it is. Press it to see the seven stops, from Plans filed to Scored, with the one that is lit and a sentence that says what is next.',
    'The robot icon’s sheet on the Bid Board shows the same stops at the top, so a phone reads the same words as the desk.',
    'Fixtures ready lights once the robot seals its number, the same moment the Plans panel lets you ask it a question. Until then the line says it is counting and when its fixtures open.',
    'The dashboard’s Needs You card says when the robot’s fixtures are ready on a live bid, and the Plans panel’s footer says they are on the Counts tab.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
