import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7642',
  date: '2026-11-17',
  title: 'Drive uploads: a busy Drive is named as busy, with its own words',
  kind: 'fix',
  highlights: [
    'When Google Drive is busy it sometimes answers with a web page. The app used to trip on that page and lose the reason.',
    'The app now reads the page, keeps what Drive said, such as "Error 502 (Server Error)", and knows a second try can help.',
    'This covers every place a file goes to Drive: photos, plan sets, receipts, mailed copies, contracts and papers from email.',
    'A page from Drive is never read as "nothing found", so the app does not make a second folder or a second copy because of one.',
  ],
}

export default note
