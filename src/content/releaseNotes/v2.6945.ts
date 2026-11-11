import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6945',
  date: '2026-11-11',
  title: 'An agent on the dev seat can change a bid after it is made',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now change a bid the way Edit Bid and the Bid Board do: its value, the day it was sent and who it went to, whether it was won or lost and why, the due date, the estimator, the GC and the notes.',
    'A bid for a proposal that went out months ago can carry the day it was really decided, so the Board and the win reports read it on the right day.',
    'Before anything changes the agent reads a plan in words: every field before and after, where the bid will sit on the Bid Board, and what the app does next. A win opens no job and tells nobody.',
    'The agent never ticks the sent checklist. Those three lines are a person’s own word, so a sent date from the agent lands the way Mark sent lands it on the Cover Letter.',
  ],
}

export default note
