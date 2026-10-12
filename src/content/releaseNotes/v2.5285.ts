import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5285',
  date: '2026-10-12',
  title: 'Settings: Contracts and clauses',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'A new Settings tab holds the papers our trade partners sign, clause by clause. Each clause is for everyone or for the trades named on it.',
    'Anyone in the office can change, add or retire a clause. A controller or a dev approves it before it goes out.',
    'A change waiting on approval shows under its clause and on the approvers’ Needs you card, with Approve and Decline.',
    'Preview per trade shows a paper as a company would get it. A signed copy keeps the words it was signed with.',
  ],
}

export default note
