import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2695',
  date: '2026-09-03',
  title: 'Job Summary — the Days view',
  kind: 'feature',
  highlights: [
    'Jobs → Job Summary has a View switch: Jobs (the ledger) or Days — one row per calendar day with how many jobs the crew carried, how many people were out, the field hours, that day\'s overhead pool, and what one job-day of overhead cost.',
    'A chart stacks each day\'s field hours by job so the height says how hard the crew worked and the colors say how many jobs they were spread across; tiles give jobs per workday (average, max, median) and a histogram of workdays by jobs carried.',
    'Days with office cost but no field work are marked unallocated — the same days the Jobs view leaves uncharged.',
  ],
}

export default note
