import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4409',
  date: '2026-10-02',
  title: 'Demand letter on a phone: the buttons at the foot take less room',
  kind: 'fix',
  highlights: [
    'On a phone the five buttons under the demand letter wrapped onto four lines and took a quarter of the window.',
    'They now sit in two rows of two. Cancel is gone on a phone, because × closes the window.',
    'Email with the PDF… now opens in place of the buttons instead of on top of them, so the letter keeps its room. Back brings the buttons back.',
  ],
}

export default note
