import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8007',
  date: '2026-11-19',
  title: 'Document builder: an insurance sheet for the subs on a job you run as the GC',
  kind: 'feature',
  highlights: [
    'A second builder, Insurance requirements for subs. It keeps your usual sheet, and one sheet for each job you run as the GC.',
    'Press any words on the sheet to change them. A job changes only what differs from your usual, and the page lists what differs.',
    'Publish your usual and the change goes to each job that is ready. A job that is held is named with its reason.',
    'Every word and amount is a placeholder. The app sets no amount. Only a dev sees the builder, and it sends nothing yet.',
  ],
}

export default note
