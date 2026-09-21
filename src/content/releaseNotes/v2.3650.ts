import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3650',
  date: '2026-09-20',
  title: 'Hiring: whoever ran a trial helper’s job is asked “take them again?” the same day',
  kind: 'feature',
  highlights: [
    'When a helper on the Try-out stage clocks out, everyone who could run that job that day — a master, or a sub or helper cleared to run a job — gets one card: Take Bryan again? Yes, No or Not sure, with an optional word for the office.',
    'The card sits at the top of their Dashboard until it is answered or skipped, through the next morning. They also get a notification that opens it, and anyone who clocks out themselves sees it right after their own clock-out.',
    'Nobody is assigned: the app reads who was on the helper’s job from the schedule and the clock. Answers are by name — the office will see which leaders want which helpers — and today’s answer can be changed.',
    'New help guide: say whether a trial helper worked out.',
  ],
}

export default note
