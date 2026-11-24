import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8430',
  date: '2026-11-24',
  title: 'Agreements: the buttons are easier to tap on a phone',
  kind: 'fix',
  highlights: [
    'On a phone, a line’s name on Documents → Agreements now stands 44 px tall, the height a thumb needs. It was 24 px. The row grows a little to make room.',
    'The chips, the buttons on a line, Send a paper, Contract library and Show more stand 44 px tall too. They were 28 px, and Send a paper 36.',
    'In Send a paper, the × of Who is it with? is a 44 px square and its chips are 44 px tall. Cancel and Send email in the Send window are 44 px tall, here and on People → Contracts.',
    'On a computer everything looks as it did.',
  ],
}

export default note
