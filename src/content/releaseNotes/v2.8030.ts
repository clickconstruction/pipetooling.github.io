import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8030',
  date: '2026-11-20',
  title: 'Accounts Receivable: the app’s role lists match the database’s four roles',
  kind: 'infra',
  highlights: [
    'Bank payments and returned checks are the office’s: dev, leader, assistant and controller. The database has refused a primary there since v2.7931, and the app’s own lists now say the same.',
    'Nothing changes on a primary’s screens. They had no door to Accounts Receivable, and the Bill tab of their own job keeps its expected pay dates and its returned checks warning.',
    'The Accounts Receivable button and the window’s role banner now name the controller, who could always record payments there.',
  ],
}

export default note
