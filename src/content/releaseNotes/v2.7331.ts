import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7331',
  date: '2026-11-15',
  title: 'The run on a phone: Scan › reads the receipt’s barcode into the Mailed box',
  kind: 'feature',
  highlights: [
    'On a phone, each Mailed box in the run’s checklist has Scan › beside it. Press it and the camera opens; hold the USPS receipt’s barcode in the frame and the tracking number lands in the box, grouped as the slip prints it.',
    'A refused camera, no camera or a browser that cannot read barcodes says so under the box, and you type the number as before. Nothing is recorded until you press Record.',
  ],
}

export default note
