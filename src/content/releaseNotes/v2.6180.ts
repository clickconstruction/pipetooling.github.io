import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6180',
  date: '2026-10-30',
  title: 'The robot writes down the fixtures it found, with their price, for the estimator to take',
  kind: 'feature',
  highlights: [
    'When a robot finishes pricing a bid it now hands over the list of fixtures it found: the tag, the schedule row, the count per sheet, where it counted each one, the plan text that backs it, its own check of the schedule against the drawings, and the price it gave each one.',
    'The list waits on the bid for the estimator. Nothing shows on a bid yet: the window where she reviews the list and adds the rows she wants to her count comes in the next releases.',
    'A bid she takes robot fixtures on reads as assisted when it is scored, and the fixtures themselves are scored against her final list: how many she took, changed, set aside, and how many the robot missed.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
}

export default note
