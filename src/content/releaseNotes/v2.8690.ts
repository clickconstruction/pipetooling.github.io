import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8690',
  date: '2026-11-27',
  title: 'A job’s Lien window closes on Escape',
  kind: 'fix',
  highlights: [
    'Escape did nothing in a job’s Lien window. Only the × closed it.',
    'Now Escape closes it, as it closes the app’s other windows.',
    'If you have typed in one of its fields and not saved, Escape leaves the window open. The form’s Cancel and the × still work.',
    'A window opened over it, such as a paper’s preview or a confirm, takes Escape first.',
  ],
}

export default note
