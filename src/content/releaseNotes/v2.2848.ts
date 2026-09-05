import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2848',
  date: '2026-09-05',
  title: 'Superintendents can open a job again',
  kind: 'fix',
  highlights: [
    'Tapping a job as a superintendent, estimator, or controller now opens the job\'s detail pane and keeps it open. Before, a Job window flashed up and closed itself a second later with "Job not found or you do not have access."',
    'The pane shows the address, status, files, reports, and the job\'s notes thread — superintendents can post a note, Arrived, or Leaving from there, on desktop as well as in Job Mode.',
    'The per-project "+ Job" / "+ Create Job" links on Projects and Workflow now only show for roles that can actually create a job (dev, master, assistant); for superintendents and primaries they did nothing.',
    'Nothing changes for devs, masters, assistants, or primaries — they keep the tabbed Job · Edit · Bill window.',
  ],
}

export default note
