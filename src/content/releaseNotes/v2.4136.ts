import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4136',
  date: '2026-09-29',
  title: 'Submittals: every robot offer reads the same way, and none shows until a robot is live',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'The three places the robot can help (read the schedule off the plans, put a PDF’s pages on rows, read a reviewer’s redlines) now say the same three things in the same order: what the robot does, what it needs and whether this bid has it, what you do after. Then whether a robot is awake: “A robot was working 12 min ago.”',
    'No robot offer shows at all until a robot seat has run in the last seven days. An offer that cannot answer is worse than none.',
    'The schedule read says it needs the plans on the bid; with no plans link the offer stays but the button waits, and the line says what to add. A “What is the robot?” link on every offer opens the guide.',
  ],
}

export default note
