import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4920',
  date: '2026-10-08',
  title: 'GC mode: a trade partner opens its own portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A trade partner company now has one private link that opens everything it has with us: each project it is asked to quote, the plans, the questions it may read, who to call and the emails we sent it.',
    'The portal reads only for now. It tells the company to email its quote or question to our project manager.',
    'A dev makes, copies, remakes or turns off each company’s link on Trade portals, beside Trade partners, and sees whether the company opened it.',
    'What customers see shows a sample company’s portal.',
  ],
}

export default note
