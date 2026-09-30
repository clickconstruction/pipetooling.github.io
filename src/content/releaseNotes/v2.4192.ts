import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4192',
  date: '2026-09-29',
  title: 'Submittals: Assign pages opens the vendor file once, and scanned pages show',
  kind: 'fix',
  highlights: [
    'Assign pages… no longer takes the computer down. The walk opened the vendor PDF again every time the tab refreshed behind it — and each re-read refreshed the tab again — so a 75-page scanned file was read hundreds of times over. It is opened once now, and read once.',
    'Scanned vendor PDFs draw their pages. The page images in a scanned file (JBIG2, JPEG 2000) came out blank in the walk, the page strip, the Form Studio and the price-request reader; the decoders they need now ship with the app.',
  ],
}

export default note
