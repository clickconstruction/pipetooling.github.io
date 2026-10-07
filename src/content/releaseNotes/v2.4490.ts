import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4490',
  date: '2026-10-04',
  title: 'AIA G702-G703: the job remembers its pay applications',
  kind: 'feature',
  highlights: [
    'Save keeps an application on the job under its number. Generate saves it too, so what you download is what the job remembers.',
    'The next application starts from the last one. Its work becomes work from the previous application, and what was certified comes off the payment due.',
    'The form has two new boxes: WORK COMPLETED FROM PREVIOUS APPLICATION and LESS PREVIOUS CERTIFICATES FOR PAYMENT. For an application sent before today, type its amounts and paste the Google Drive link to its file.',
    'Saved applications are listed at the top of the form. Open one, change it and save it again. Nothing locks. The window asks before you lose what you typed.',
  ],
}

export default note
