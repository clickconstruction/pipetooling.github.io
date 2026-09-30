import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4256',
  date: '2026-09-30',
  title: 'Robots: the six numbers on every lens, and a line that says what each lens is for',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The Robot Board’s strip — how many bids have a robot run, live bids shadowed, sealed numbers, bids that need a person, audits waiting, kinds of job that earned first drafts — now heads every lens under Bids → Robots, and each tile opens the lens that works it.',
    'A line beside the Robot Board · Audits · Scoreboard bar says what the open lens is for, the way the Followup bar does.',
    'On the Robot Board, an explanation repeated down several rows (“No plans link — paste the plan set…”) is said once per section; the rows after it read “same as above”.',
    'The “robot shells with no bid of ours to mirror” line is the operator’s, so only a dev sees it.',
  ],
}

export default note
