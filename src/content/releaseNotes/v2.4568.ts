import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4568',
  date: '2026-10-05',
  title: 'Lien desk: a printed notice has a way forward',
  kind: 'fix',
  highlights: [
    'A notice in In the mail · tracking owed now has buttons under it: Record the mailing opens the run, and Back to ready puts it back if it was never mailed.',
    'Send the run now counts printed notices too, so the button stays when only printed notices are left.',
    'The desk opens on every list unless a link names one. A list picked by an earlier link no longer sticks.',
    'Moving to another job closes any open box and clears what you typed in it, so nothing carries over to the wrong job.',
  ],
}

export default note
