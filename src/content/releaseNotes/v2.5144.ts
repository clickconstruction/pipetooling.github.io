import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5144',
  date: '2026-10-10',
  title: 'A returned check fee comes back to its case when its bill goes',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'When a bill that carries a returned check fee is sent back or deleted, the fee comes off with it, and so does the job’s total.',
    'The case then says the fee came off with its bill and offers the press again. Before, it still said the fee was on and refused to add it.',
  ],
}

export default note
