import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7556',
  date: '2026-11-16',
  title: 'Bids and jobs: a logo in an email’s signature is not a file to keep',
  kind: 'fix',
  highlights: [
    'Most email carries a small picture in the sender’s signature. It no longer makes Keep its files on the bid or Keep this mail as a paper show on an email with nothing else to keep.',
    'When an email has a real file too, the logo is listed in the form with its tick off. You can still tick it.',
  ],
}

export default note
