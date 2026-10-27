import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5995',
  date: '2026-10-27',
  title: 'GC mode: the schedule builder’s kernel, a template of phases and rows put on a job from a start day',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A schedule template can now hold named phases and rows with no dates: each row a trade’s, ours or the office’s, with its days, what it waits on and a milestone tick. A template saved before still reads, its stages as the phases.',
    'Put on a job from a start day, every row lands: on the job’s line of the same trade and name, as the job’s own work on that package, or with no company yet when the job has no package for the trade. Milestones land as dates to meet, and the job’s own scope lines in no row take the stage days.',
    'A template counts its days Monday to Friday when it says so, gaps the same way, and never starts a row on a weekend. The chart still works any day.',
    'Before the draw, the fit says what will land: the rows and phases, the weeks, the trades with no package yet, ours, the office’s, the dates to meet and the scope lines in no row. Nothing on screen yet: the Templates page and the job’s side follow.',
  ],
}

export default note
