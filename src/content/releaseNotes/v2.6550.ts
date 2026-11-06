import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6550',
  date: '2026-11-05',
  title: 'End employment and Bring back move the row on the roster behind the desk, and the Wage row reads the wage you typed',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'After End employment, the person leaves the roster and lands on the Archived list at once. After Bring back, they leave the Archived list and return to their roster group. Before, both waited for a page reload, and the Archived list still offered Bring back… on someone already back.',
    'On the Bring back window, Change… on a person with no pay row now reads the wage you saved, set on the day back. Before, the row kept reading No pay setup under its green dot.',
  ],
}

export default note
