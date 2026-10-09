import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5082',
  date: '2026-10-09',
  title: 'Lien desk: Approve ▸ is now Sign and approve ▸, one press puts the leader’s name on the notice',
  kind: 'feature',
  roles: ['master_technician', 'assistant', 'controller', 'dev'],
  highlights: [
    'The notice’s own signature line now sits in the desk footer and on the phone card, with the leader’s name waiting on it in cursive. One press of Sign and approve ▸ places the name, dates it, records who pressed and from where, and approves. Draw instead turns the line into a pad for the days he wants ink.',
    'The signature belongs to the notice as he signed it. A draft saved after signing, a pull-back or an undo clears it, and the Ready chip reads signed or unsigned.',
    'A notice approved on the leader’s word reaches Ready to send unsigned; the Ready footer offers him Sign ▸ to put his name on it from anywhere.',
    'Put a GC on notice’s Approve all is Sign and approve all: each notice in the batch gets its own signature from the one press. The retainage notice signs the same way.',
  ],
}

export default note
