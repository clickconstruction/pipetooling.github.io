import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5729',
  date: '2026-10-22',
  title: 'Estimates and Messages: only a real account sends',
  kind: 'fix',
  highlights: [
    'Sending an estimate now checks who is pressing. A View-as sample, a robot or a training account could read a draft and send it to a real customer. They are refused with a plain reason.',
    'The walk kit’s hidden tester, a training account, may press three sends and nothing else: the estimate email, the estimate text and a reply by email, each only to the kit’s own test customer at the company’s own inbox and number. Anywhere else it is refused: “The walk tester sends to the walk kit only.”',
    'Nothing changes for the office. Your sends go as before.',
  ],
}

export default note
