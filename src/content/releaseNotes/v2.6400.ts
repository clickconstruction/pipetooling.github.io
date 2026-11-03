import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6400',
  date: '2026-11-02',
  title: 'The Warranty step reads the paper, and the thread sends its link',
  kind: 'feature',
  highlights: [
    'A homeowner’s step card and the morning run now read the warranty: one out to sign shows the Warranty step aside from the lane as waiting on them, with Remind them, and a signed one reads done with its day. A homeowner with no warranty never sees the step.',
    'In the customer’s thread, type /warranty to list their warranty out to sign and put in a line with its link, or use the {warranty} blank in a quick reply. The link is the one the Contract window sent, so nothing is minted.',
    'The guide “send a homeowner the warranty in place of a contract” walks the office through the Paper pick, the lines to initial, the three ways to send it and what it leaves behind.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
