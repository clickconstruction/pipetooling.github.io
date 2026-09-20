import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3630',
  date: '2026-09-19',
  title: 'Submittal robot: either robot seat can take a task — and the one that reads the fixture schedule can open the plans',
  kind: 'fix',
  highlights: [
    'Ask the robot… on Bids → Submittals now works whichever robot picks the task up. Before, the pricing robot was turned away at the door, although its instructions said submittal tasks were its work too.',
    'Read the fixture schedule could not open the plans: a robot reads plans only on bids it created or is assigned, and the office\'s bids belong to people. Now the task itself opens that one bid\'s plans to the robot holding it — for as long as the task is being worked, and no other bid.',
    'Nothing changes for the office: a person still confirms every row the robot reads, and the robot never sends or decides.',
  ],
}

export default note
