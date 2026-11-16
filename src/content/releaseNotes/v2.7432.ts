import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7432',
  date: '2026-11-16',
  title: 'Lien desk: open or save one page of a notice by itself',
  kind: 'feature',
  highlights: [
    'Each page bar of a monthly notice ends in two presses. Open ↗ shows that page alone in a new tab, as it prints. PDF ↓ saves the same page as a file.',
    'The file is named for the job and the page, like 523 Mission Hills, cover letter.pdf.',
    'Until the notice is approved, the foot of the page reads Draft, not sent with the day. Once it is approved, that line is gone.',
    'A saved page of an approved notice is kept under Sent from this job as Saved as a file. On a phone the two presses are the arrows alone.',
  ],
}

export default note
