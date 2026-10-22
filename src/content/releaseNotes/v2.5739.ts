import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5739',
  date: '2026-10-22',
  title: 'Messages: the walk, in one command',
  kind: 'feature',
  highlights: [
    'A session can now test the whole Messages loop on its own: an estimate email and text go out to the company’s own inbox and number, the link is opened, a reply comes back by email and by text, then STOP and START. It reads what landed where, with times, and removes its test rows after.',
    'The sends come from the hidden tester account and reach only the test customer at the company’s own address and number. Nothing goes to a real person.',
    'If a step does not land in time, the report says what it waited for and what it saw, and the rest of the walk still runs.',
  ],
}

export default note
