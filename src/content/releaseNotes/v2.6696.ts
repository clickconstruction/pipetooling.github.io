import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6696',
  date: '2026-11-08',
  title: 'Legal desk: the firm reads each line of the claim',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The law firm’s portal now shows The claim on the Account tab: the open bills, the retainage held, every line the office typed with its grounds and its document, and the total. Before, only the printed packet carried the lines.',
    'The matter card’s total demand reads the claim plus the firm’s fees and costs, the open bills named inside it, so the firm and the desk’s How much? say one figure.',
    'The firm’s own printed packet carries the same table under Account and the claim beside the balance.',
  ],
}

export default note
