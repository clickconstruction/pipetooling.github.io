import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4334',
  date: '2026-10-01',
  title: 'Release of Lien: the amount shows its commas as you type',
  kind: 'feature',
  highlights: [
    'The Amount box in step 3 of the Release of Lien window now shows commas as you type, so 17777.51 reads 17,777.51. The cursor stays where you are typing.',
    'Backspace right after a comma removes the digit before it. A pasted “$17,777.51” reads as the number, letters are ignored, and only two digits go after the dot.',
    'Leaving the box shows the cents, so 9000 becomes 9,000.00. Just clicking through the box changes nothing.',
  ],
}

export default note
