import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6110',
  date: '2026-10-29',
  title: 'Other job charges read as money',
  kind: 'feature',
  highlights: [
    'An other charge’s amount shows with thousands commas and the cents drawn smaller, on the Costs tab, the Job tab and every cost accordion’s total. Click into the box and it is the plain digits again.',
    'A charge whose description starts with ESTIMATE wears an Estimate chip and shows the words after it, so an estimate is told from a posted charge at a glance; the whole description is there to change when the box has focus.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
