import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6226',
  date: '2026-10-31',
  title: 'A combined job keeps the old HCP and C# numbers',
  kind: 'feature',
  highlights: [
    'When you combine two jobs, the source\'s HCP number and C# stay on the job that remains, as prior numbers. The House Call Pro numbers from the old system are never lost.',
    'The Pipeline row\'s number chip and the Development page\'s Jobs & bids table read them: also 550 · 549.',
    'Search the Pipeline or any job picker by an old number and the combined job comes up.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
