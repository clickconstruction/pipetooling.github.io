import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4563',
  date: '2026-10-05',
  title: 'Lien window: a saved copy link typed while recording is kept',
  kind: 'fix',
  highlights: [
    'In a job\'s Lien window, the Saved copy link and note you type while recording a notice, a filing or a release are now saved with the record.',
    'Before, they could be dropped, and the record showed no saved copy until you added the link again from the Filings list.',
    'Records made earlier are not changed. If one is missing its link, add it from the Filings list.',
  ],
}

export default note
