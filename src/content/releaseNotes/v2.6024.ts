import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6024',
  date: '2026-10-28',
  title: 'GC mode: Start from a template draws every row from the start day, and the schedule reads By phase',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Start from a template on a first draft now lands every row of a template made as phases and rows: on the job’s line of the same trade and name, as the job’s own work on that package, or with No company yet when the job has no package for the trade. The pick says what will land before the draw.',
    'The chart opens By phase when the schedule was drawn from phases, each phase a row reading its start, end and days from its rows, and the list groups by phase too.',
    'The list shows each row’s days and spare days, and No company yet is a door to Trade partners at that trade.',
    'The Templates card under a job’s chart keeps Save as a template and opens the Templates page for the rest.',
  ],
}

export default note
