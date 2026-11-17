import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7519',
  date: '2026-11-16',
  title: 'Print labels: a card says which boxes are not printed yet',
  kind: 'feature',
  highlights: [
    'The app now marks a box when its label prints. On Materials, Print labels, a job’s card counts the boxes whose label has not printed yet, and The 6 not printed yet opens the labels on those alone.',
    'After a print, a line says how many boxes were marked. If the labels did not come out, Take the mark off puts them back.',
    'For a box that already wears a label, tick it and press Mark 1 box as labelled. A box that wears a sticker counts as labelled.',
    'The mark starts on November 17. A box made before that day is not counted until its label prints. The card no longer counts the boxes added this week.',
  ],
}

export default note
