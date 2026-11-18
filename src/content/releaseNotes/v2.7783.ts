import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7783',
  date: '2026-11-18',
  title: 'Lien desk: a held paper stands in the bin where it is stopped, with a hold mark',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Board has no Held bin any more. A held paper stands in the bin of the stage it is stopped at, after the papers that can move.',
    'An approved affidavit that a property fact holds stands in Ready to file. A paper the leader held stands in Awaiting Master approval.',
    'A held chip has a dashed edge and a ‖ mark. Its colour is still its day, so red still means late. One press opens the place where it is fixed.',
    'A bin counts the papers that can move, so its count and its press are one number. The line 1 held on a property fact is gone from Ready to file.',
  ],
}

export default note
