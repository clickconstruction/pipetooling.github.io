import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4232',
  date: '2026-09-30',
  title: 'Audits: the robots’ questions, one at a time',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Bids → Robots → Audits opens with one sentence that sizes today — “19 questions, about fifteen minutes. Then 31 audits. 8 more open when you send.” — and one button, Answer the 19 questions.',
    'The button opens a run-through: one question is the whole screen, the robot’s pick is the first big button, 1–4 tap an answer, Enter takes the robot’s pick, → skips, Esc closes. Not mine and Dismiss sit in the corner where they cannot be hit by accident.',
    'Shared questions come first (one tap lands on every open copy), then today’s, then the older asks. At the end the sheet lists what was saved.',
    'Under the button, the panel reads Questions · 19 with one line per question; tap a line to start there. The sixteen cards and their ninety-odd buttons are gone.',
  ],
}

export default note
