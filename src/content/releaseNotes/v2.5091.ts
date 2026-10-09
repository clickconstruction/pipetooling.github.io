import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5091',
  date: '2026-10-09',
  title: 'Edit Job: a returned check’s $30 fee stays in the job’s total',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'After the $30 returned check fee went on a bill, the next money edit in Edit Job took it out of the job’s total while the bill kept it. Edit Job now counts the fee in the Job Total as a rider, so the total still covers every bill.',
    'Adding a discount in Bill Customer, recording a tip from a deposit and adding a line in Collect Payment keep the fee too.',
  ],
}

export default note
