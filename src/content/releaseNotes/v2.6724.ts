import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6724',
  date: '2026-11-08',
  title: 'Open the signed PDF shows its link when the browser blocks the tab',
  kind: 'fix',
  roles: ['dev', 'controller'],
  highlights: [
    'On a signed hours statement’s card under Hours statements, Open the signed PDF asks the server for the link first, so some browsers block the tab that follows. The press used to say only that the window was blocked.',
    'Now it shows the link in a small window, the same one the statement window and Sign here now already use. Open the link from there; it works for five minutes. Press I opened it to close the window.',
  ],
}

export default note
