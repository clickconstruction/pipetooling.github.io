import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5791',
  date: '2026-10-23',
  title: 'Lien desk: the master signs on anyone’s screen with his signing code',
  kind: 'feature',
  roles: ['assistant', 'controller', 'master_technician', 'dev'],
  highlights: [
    'Open a notice on a screen that is not the master’s own and the signature line is his: his name in cursive, a code field under the rule, Sign and approve ▸. He types the code he set in Settings, the app checks it, and his name goes on the paper. The record names whose screen it was.',
    'A wrong code says so and counts the tries left; five lock the code for fifteen minutes. Draw instead lets him sign in his own hand on that screen, and a drawing there is his, never the signed-in user’s. The office sees the same line above Leader here, Approve ▸.',
    'His phone gets one line each time his code signs a notice. On his own screen the notice sits first under Signed with your code, as recorded, with Yes, it was me ▸ and Not me. Not me clears the signature, keeps the approval, and the run holds the notice until it is signed again.',
    'Before this, a dev who pressed Approve saw his own name in cursive over the master’s license, and one press would have signed with it.',
  ],
}

export default note
