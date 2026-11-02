import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6325',
  date: '2026-11-01',
  title: 'A screen that could not load with no signal says so, never that nothing was saved',
  kind: 'fix',
  highlights: [
    'When a list or a card cannot load with no signal, its red line now reads: No connection, so this could not load. Nothing was lost. It loads again when the signal is back. Before, it said nothing was saved, which is a save’s sentence, and beside a Clock Out kept on the phone it read as the press failing.',
    'The line still offers Retry, and the screen still loads again by itself when the signal comes back. A refusal still shows its reason with no Retry.',
    'This is every screen that only shows you things: Crew Day, My Schedule, My crew, My vehicle, the Job Mode card, My requests, Customers, the Dispatch Mode home and schedule, Job Tally, Checklist, Training, Documents, a job’s Materials, Quickfill and the rest. A save with no signal keeps its own sentence, since you are the one who sends it again.',
    'The help guide Know what No connection means and what was saved now says what the read sentence means.',
  ],
}

export default note
