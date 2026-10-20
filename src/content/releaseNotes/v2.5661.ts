import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5661',
  date: '2026-10-20',
  title: 'Reports: the rule behind marking each line of a job',
  kind: 'feature',
  highlights: [
    'A field report on a job with more than one line is about to ask how far along each line is, instead of how complete the whole job is. This release holds the rule the app will use to turn those answers into the job’s one number.',
    'Each line counts by its share of the job. The number a tech gives for a line moves the job by that share. A line whose draw is paid counts as done whatever was said.',
    'Nothing changes on screen yet. The report form and the Update % done stepper pick it up in the next releases.',
  ],
}

export default note
