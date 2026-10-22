import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5737',
  date: '2026-10-22',
  title: 'Bids: ask the robot to look at the plans, and make an RFI of what they do not say',
  kind: 'feature',
  highlights: [
    'When the plans’ own answer is not enough, press Ask the robot to look under the card. The robot reads the sheets on its next round and answers within a few minutes, naming the sheets it read. The thread stays on the bid for the office, and your Dashboard says when the answer is there.',
    'The robot looks at a bid only after it has sealed its own number on it, so your question never reaches it before its number exists. Before you send, it never gives a count or a price of its own. Counts come after you send.',
    'When the answer says the plans do not say, Make this an RFI files the question on the RFI tab with the sheet the robot cited.',
  ],
}

export default note
