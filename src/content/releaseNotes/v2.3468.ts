import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3468',
  date: '2026-09-14',
  title: 'Submittals: the sheet strip — tap the pages onto their rows, then let the rest of the file go',
  kind: 'feature',
  highlights: [
    'On the Submittals tab, each vendor PDF you dropped shows its pages as thumbnails. Tap a page, then the row it belongs to (rows still owing a sheet come first), and the page joins that row\'s cut sheet; tap the chip to take it off. A page on two rows reads red with a one-tap fix.',
    'The footer counts "6 of 31 pages on rows · 25 not used". Done with this file keeps the pages on rows and lets the rest go — the file shrinks in storage, every row still points at its sheet, and a quiet line records what left. Remove this file when nothing from it landed.',
  ],
}

export default note
