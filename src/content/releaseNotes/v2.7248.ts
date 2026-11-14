import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7248',
  date: '2026-11-14',
  title: 'A test of the lien § Rules window no longer fails by chance',
  kind: 'fix',
  highlights: [
    'Nothing in the app changed. One of the checks that runs before a change ships failed once on a busy machine, and held up a change that had nothing to do with it.',
    'The check pressed Esc once, the moment the § Rules window appeared, and then waited for the window to close. It now presses Esc until the window hears it.',
  ],
}

export default note
