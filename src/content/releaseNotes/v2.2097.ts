import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2097',
  date: '2026-08-22',
  title: 'Add-task modal survives "Go to checklist"',
  kind: 'feature',
  highlights: [
    'Clicking the checklist icon in the Add-task window now brings up the Checklist page behind it without closing the window — everything you typed stays put, so a stray click costs nothing.',
    'It also lands you on the Today tab even if you started from Review or History.',
  ],
}

export default note
