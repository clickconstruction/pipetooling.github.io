import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5688',
  date: '2026-10-20',
  title: 'Jobs: leave a report from the job window',
  kind: 'feature',
  highlights: [
    'A job’s window now has a ＋ Report chip in its activity list, right after the Reports pill. Press it and the report form opens for that job, the same one the reports list opens. On a job with more than one priced line it asks how far along each line is.',
    'When the report saves, the feed shows it at the top, the Reports pill counts it, and the job’s percent follows the report.',
    'Before, leaving a report from the window took the Reports box lower down, then the reports list, then Add additional report. Those still work.',
  ],
}

export default note
