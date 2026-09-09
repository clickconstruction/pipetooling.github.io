import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3186',
  date: '2026-09-09',
  title: 'Robot questions go to the right person',
  kind: 'feature',
  highlights: [
    'Standing rulings on Bids → Audits now shows only questions about the job — scope, counts, pricing, which sheet governs. When a robot\'s problem is its own machine (a sandbox, a sign-in, a file it can\'t open), that question goes to the person who runs the robots instead.',
    'Two new buttons on every question: Not mine sends a stray one to the robot operator, and Dismiss closes a question you don\'t intend to answer, so it stops coming back.',
    'The robots are told to write estimator questions as one decision in two sentences, naming the project and the sheet — never a run code or a table name.',
    'Settings → Digital twins (dev) shows each question\'s lane, sorts the operator\'s first, and can send one back to the estimator.',
  ],
}

export default note
