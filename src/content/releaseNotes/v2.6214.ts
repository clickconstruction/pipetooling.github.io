import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6214',
  date: '2026-10-30',
  title: 'The Questions look on a Development page: two presses, then the questions in tables',
  kind: 'feature',
  highlights: [
    'The Questions look starts with two buttons, Ask the estimators and Ask Dispatch, always there.',
    'Under them, one table for each lane that has questions: open ones first and oldest first, with how long each has waited, what it is about, the question and the answer so far. The answered ones fold under a count.',
    'With no question at all the look says nothing is waiting. The customer\'s answers and the payments stay on the Waiting count\'s card, where they belong.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
