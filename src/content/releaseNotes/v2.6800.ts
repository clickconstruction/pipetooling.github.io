import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6800',
  date: '2026-11-09',
  title: 'Tape labels, step one: the labels as a CSV, and Copy the label code at the cage',
  kind: 'feature',
  highlights: [
    'In the Labels window on Jobs → Materials, Export the labels as a CSV writes one row per cage or box: the stencil, the place, the code with its dash, the address and the text the QR carries. Open it in Brother P-touch Editor to print a whole job on tape.',
    'On the phone, under a box\'s parts, Copy the label code puts the address on the clipboard. Paste it into the Brother app as a QR code and print the label at the cage.',
  ],
}

export default note
