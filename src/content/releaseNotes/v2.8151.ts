import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8151',
  date: '2026-11-20',
  title: 'Document builder: send the Sub NDA to a GC',
  kind: 'feature',
  highlights: [
    'The Sub NDA has a card, Send it to a GC. It lists each customer who is the GC on a job with you, with a box to find one.',
    'A send picks the person and what it is about: one job, or all their jobs. The row then says the day it went and the day they opened it.',
    'The GC gets an email with a link to their own page. The builder is there, under the job it is about, to open and walk. They can look only.',
    'The one button for every GC asks first and says how many. Only a dev sends for now, and every word is still a placeholder.',
  ],
}

export default note
