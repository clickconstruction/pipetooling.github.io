import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5788',
  date: '2026-10-23',
  title: 'Settings: a master sets his own signing code for the Lien desk',
  kind: 'feature',
  roles: ['master_technician', 'dev'],
  highlights: [
    'Settings → Your account has a new card, Your signing code. A master or dev sets a code only he knows, four to six digits, typed twice. He can change it or remove it any time.',
    'The app keeps a scrambled copy and checks the code itself. Nobody can read it back, and five wrong tries lock it for fifteen minutes.',
    'The next release puts a code field on the Lien desk: the master types his code on anyone’s screen to sign and approve a notice, and the record names whose screen it was.',
  ],
}

export default note
