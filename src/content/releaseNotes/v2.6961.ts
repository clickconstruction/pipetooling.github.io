import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6961',
  date: '2026-11-11',
  title: 'Lien help sheets: a picture of the paper, papers grouped by county clerk, who to ask, and lines to write on',
  kind: 'feature',
  highlights: [
    'Each help sheet now has a small picture of the paper with a numbered spot where each thing is written, and names who to ask: the lien leader on the job, or the dev.',
    'A batch prints in county clerk order. The help sheet gives each clerk a row above its papers, so filing is one trip for each clerk.',
    'The steps after the notary have lines to write the recording number, the day filed and the day to mail by. Type each clerk’s address, fee and hours once in Settings, under County clerks, and the sheets print them.',
    'Every help sheet has a striped top edge and a code that opens the full guide on a phone. The guide copy says GUIDE COPY across its paper.',
  ],
}

export default note
