import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7556',
  date: '2026-11-16',
  title: 'Bids: Keep its files on the bid reads real email better',
  kind: 'fix',
  highlights: [
    'Most email carries a small picture in the sender’s signature. It no longer makes Keep its files on the bid or Keep this mail as a paper show on an email with nothing else to keep.',
    'When an email has a real file too, the logo is listed in the form with its tick off. You can still tick it.',
    'The memo now names who sent the email without their email address.',
    'The form shows each file’s size the way the email shows it.',
  ],
}

export default note
