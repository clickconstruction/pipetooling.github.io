import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7090',
  date: '2026-11-12',
  title: 'Pay codes print in PDFs again, and the bill’s QR window can copy its image',
  kind: 'fix',
  highlights: [
    'A pay code now prints in a PDF. It was an empty square on a lien notice’s pay page, on a letter mailed for you and on a demand letter.',
    'On a bill, the QR window can copy the code as an image and download it again.',
    'The page on screen always showed the code. Only the PDF and the image were missing it.',
  ],
}

export default note
