import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4326',
  date: '2026-10-01',
  title: 'Submittals: the house’s own file builds the parts',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'A supply house’s submittal PDF with a contents page now reads as a parts list. Read its parts… on the file’s line shows every part under every tag, with its pages.',
    'A review sets the file beside your rows before anything is written. Each part reads the same, in place of a part you priced, or not priced. You choose what is kept.',
    'Use the file’s parts gives each row the house’s parts with their own pages. A part that is not what you priced shows the priced part beside it.',
    'The package stamps each part’s pages with that part. A tag the file has and no row carries can come in as a new row.',
  ],
}

export default note
