import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7438',
  date: '2026-11-16',
  title: 'Stickers: the running number is gone',
  kind: 'feature',
  highlights: [
    'A sticker no longer prints a running number like 0147. A named sticker prints its name and its link, the same shape as a box label.',
    'A sticker with no name prints its code in larger type, since the code is the one thing to read on it.',
    'The screens follow. The scan sheet, the Runs fold, the print window and the box page say a sticker’s name, or this sticker, never a number.',
    'Scan a label takes the eight characters under the QR. Four digits typed are no longer looked up as a sticker.',
  ],
}

export default note
