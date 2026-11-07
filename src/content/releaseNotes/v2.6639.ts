import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6639',
  date: '2026-11-07',
  title: 'The dev sign-in door opens a dev or a digital twin and no one else',
  kind: 'fix',
  highlights: [
    'The password-free dev sign-in used on the dev server took any address. A session it opened as a teammate was never on the View as record, so Messages → My email would have read that teammate’s Gmail in it. It now signs in a dev or a digital twin only, and anyone else answers with the words that name View as, which puts the session on record so My email refuses it.',
    'Nothing changes for the dev server, the Claude pane sign-in or the twins: those were the only accounts the door was ever used for.',
  ],
}

export default note
