import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4737',
  date: '2026-10-06',
  title: 'Cover Letter: what you type in the three boxes stays with the bid',
  kind: 'fix',
  highlights: [
    'Additional inclusions, Exclusions and scope, and Terms and warranty are now saved on the bid as you type. Before, a reload emptied them.',
    'Open the bid again, on any computer, and the boxes read what you typed. A box you never typed in still shows the office default.',
    'The bid’s history keeps each change to the three boxes too.',
  ],
  roles: ['estimator', 'master_technician', 'assistant', 'controller'],
}

export default note
