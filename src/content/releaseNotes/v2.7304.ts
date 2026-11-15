import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7304',
  date: '2026-11-14',
  title: 'Print blank stickers: see what the stickers will look like before you print',
  kind: 'feature',
  highlights: [
    'The Print blank stickers window has a fold at its foot, What the stickers will look like. Open it and the first six strips are drawn exactly as the tape prints them, at the tape width you picked, with the run’s own numbers, like 0003 to 0008 after a last run that ended at 0002.',
    'Copies of each shows in the strips: with two copies they read 0003, 0003, 0004, 0004. A line under them says and 194 more, to 0202, and Show all 200 draws the rest smaller. A run past 200 draws the first 200 and says so.',
    'Each sticker’s code is given when the run prints, so the strips carry a sample code in its place, and a line says so. The test strip is drawn the same way, so the fold also shows what Print 1 test strip prints.',
    'The fold stays closed until you open it, and this computer remembers your choice, as it remembers the tape width and the copies.',
  ],
}

export default note
