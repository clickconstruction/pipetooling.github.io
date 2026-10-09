import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5046',
  date: '2026-10-09',
  title: 'Bid vs actual: each job’s margin at completion, by section and by stage',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Bids → Bid Costs → Bid vs actual has a Direct column: each linked job’s margin at completion, read the same way its Costs tab reads it, and how many points it runs under or over the price.',
    'Press ▸ beside a job to open its spend by section: labor, materials, subs and other, against the bid’s figures.',
    'Every row also shows earned value by stage: the bid’s hours for each stage, earned at that stage’s progress, set against the hours recorded.',
    'A stage nobody has reported says so instead of reading 0%. Dollar figures stay with the roles that see wages.',
  ],
}

export default note
