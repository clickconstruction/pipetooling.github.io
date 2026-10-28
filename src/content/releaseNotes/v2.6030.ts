import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6030',
  date: '2026-10-28',
  title: 'Messages: the walk kit’s driver reads both key files, rides out a lost signal, and reads a press made before a restart',
  kind: 'fix',
  highlights: [
    'The walk kit’s one command now reads its keys from both of the main checkout’s env files, and a missing key says which key is missing and which files were read.',
    'A lost signal in the middle of a wait no longer ends the walk: the poll is tried again on the next look, and a wait that never succeeds holds its step with the last error it saw.',
    'When the owner pressed the sends before the walk was restarted on a kept kit, the walk reads that press instead of waiting three minutes for a new one.',
    'A restart on a kept kit no longer seeds a second “older text of ours”: one seed per kit.',
  ],
}

export default note
