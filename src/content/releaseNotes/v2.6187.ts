import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6187',
  date: '2026-10-30',
  title: 'A dev’s agent can set its own Mac up with a twin key, without the key passing through a chat',
  kind: 'feature',
  highlights: [
    'The dev MCP seat has a new verb, mint_twin_setup_code. It mints the same ten-minute, single-use setup code that Set up on this Mac makes, for any twin, with a label naming the Mac.',
    'A new shell script, redeem_setup_code.py, turns the code into the key file the twin toolkit reads. It writes the key with mode 600 and prints nothing secret. The key itself never comes back through the seat.',
    'After that the agent runs /bid on that Mac. The fleet lists the key by its label, and Settings → Digital twins revokes it as before.',
  ],
  roles: ['dev'],
}

export default note
