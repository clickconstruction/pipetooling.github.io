import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5086',
  date: '2026-10-09',
  title: 'Lien desk: the run holds an unsigned notice, and the leader can sign it on your screen',
  kind: 'feature',
  roles: ['master_technician', 'assistant', 'controller', 'dev'],
  highlights: [
    'An envelope with a notice the leader has not signed is held back with the others the run holds: listed in red with the reason on the checklist sheet and in the run window, never printed, never recorded. The counts match the paper.',
    'When the leader is beside you, press Leader here, sign ▸ on the held row. He draws his signature on your screen, the record names your screen, and the envelope goes back into the run.',
    'Otherwise he signs it from his own phone with Sign ▸ on the notice, and the run picks it up on its next open.',
  ],
}

export default note
