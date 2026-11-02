import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6378',
  date: '2026-11-02',
  title: 'The Development page’s table and History read shorter: archived bids fold, like lines fold, a shadow bid wears its chip',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Jobs & bids folds the archived bids under one line, Archived, with their count and what they bid. Press Show them to see them. The strip and the fold count the live rows only.',
    'The live rows read in order: the bids still working, then the won bids with the job each became, then the jobs with no bid. The waiting jobs come first, oldest on top.',
    'History folds a run of three or more like lines on one day, the same act on the same record by the same person, into one line with the count. Questions, answers and kept entries never fold, and a search sees every line.',
    'A robot estimator’s shadow bid stays in the table with a shadow chip and is left out of the counts and of the people at the top.',
  ],
}

export default note
