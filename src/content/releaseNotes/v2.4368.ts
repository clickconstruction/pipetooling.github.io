import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4368',
  date: '2026-10-01',
  title: 'Approval PDF: a Combined bid counts its materials',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The Approval PDF only counted materials from By Stage purchase orders. A Combined bid, which is every bid since May, showed $0 of materials and too high a margin.',
    'It now counts the takeoff’s parts list, the same number Pricing and Labor show. The cost estimate and margin on its first page match Pricing.',
    'On a Combined bid the Labor page prints one Materials line instead of three empty purchase order lines. A By Stage bid still prints its three purchase orders.',
  ],
}

export default note
