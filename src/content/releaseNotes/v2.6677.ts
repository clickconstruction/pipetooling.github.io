import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6677',
  date: '2026-11-08',
  title: 'The estimate text’s link ends in ten letters',
  kind: 'feature',
  highlights: [
    'The link the Tell the customer sheet texts with an estimate now ends in a ten-letter code instead of 32 characters: 53 characters of link in place of 75. The letters come from an alphabet with no 0, O, 1, l or I, so a customer can read the code aloud over the phone without a mistake.',
    'The code opens the same page with the same powers for the same 14 days, and a link texted before this change keeps working until its day.',
    'A guard counts wrong links by the connection they came from. After 20 in an hour that connection is told to wait, while a customer with a working link is never turned away.',
  ],
}

export default note
