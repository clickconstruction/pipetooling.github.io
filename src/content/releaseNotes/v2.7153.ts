import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7153',
  date: '2026-11-13',
  title: 'Pay calendar: a job on its own calendar says so',
  kind: 'feature',
  highlights: [
    'A billed row whose job is on its own pay calendar reads This job’s own before the calendar’s words. The cutoff line on a job not yet billed says it too.',
    'A job with its pay calendar switched off reads No pay calendar on this job under its dates. Press it to open the window on that job.',
    'A customer’s pay calendar window lists the jobs that do not follow it. Press a job to open its own.',
    'Cutoffs coming names the job on a line that is one job’s own calendar.',
  ],
}

export default note
