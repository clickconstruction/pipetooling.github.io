import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5187',
  date: '2026-10-10',
  title: 'GC mode: one count of everyone we wait on, on Follow up and the Dashboard',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Follow up’s button and the Dashboard’s GC projects line now count everyone we wait on, each person once across their jobs.',
    'Follow up gains By people, which lists them all with every reason and Call. By urgency keeps the quote cards.',
    'By people also shows what the quote cards never did, such as insurance that ran out or a contract not yet signed.',
  ],
}

export default note
