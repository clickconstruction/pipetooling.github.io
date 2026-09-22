import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3716',
  date: '2026-09-22',
  title: 'Robots → Console opens again, and the Desktop setup commands take the new address',
  kind: 'fix',
  highlights: [
    'Bids → 🤖 Robots → Console had been failing to open since the robots\' connector moved to mcp.clicktooling.com/twin on 2026-09-20: the tab built its Terminal setup command from the new address, and the command\'s own safety check still only knew the old one. The check now accepts both.',
    'The same check broke "Set up on this Mac" (after the code was minted) and "Copy Desktop setup command" on a fresh twin key. All three work again, and a test pins the exact address every button hands out.',
  ],
}

export default note
