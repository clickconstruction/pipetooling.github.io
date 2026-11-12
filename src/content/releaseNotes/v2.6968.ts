import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6968',
  date: '2026-11-12',
  title: 'An agent on the dev seat can fill in a bid’s takeoff',
  kind: 'feature',
  highlights: [
    'A dev’s agent can now put parts on a bid’s count rows, the way the Takeoffs tab does: the part, how many one fixture takes, and its price.',
    'A part with no price given takes the parts book’s lowest price. A part sold in sticks or boxes rounds up as it does on the tab.',
    'When the paper only says what a fixture’s materials cost, the agent can record that cost for the row, with who quoted it.',
    'Before anything changes the agent reads a plan in words: each line as it will read, and the bid’s materials total before and after.',
  ],
}

export default note
