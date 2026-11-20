import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8109',
  date: '2026-11-20',
  title: 'The bank payments desk closes to a primary all the way',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'Two parts of the bank payments desk still answered a primary in the database: applying a deposit and adding a tip. Three of the desk’s lists did too. No screen of a primary’s showed any of them.',
    'Now they are the office’s alone, like the rest of the desk since v2.7931.',
    'A primary still records payments on their own jobs from the job’s Bill tab. The office works as before.',
  ],
}

export default note
