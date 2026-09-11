import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3277',
  date: '2026-09-11',
  title: 'Set up the pricing robot on your Mac with one command — no key to copy',
  kind: 'feature',
  highlights: [
    'Robots → Scoreboard → Pricing robot has a Set up on this Mac button. Type whose Mac it is, copy one command, paste it into Terminal, press Return.',
    'The command makes the robot key on the server and writes it straight into Claude Desktop — nobody ever sees it — then restarts Claude Desktop with the robot connected and the kickoff on your clipboard.',
    'Start a new incognito chat in Claude Desktop and paste: the robot prices every queued request and asks you where the plans decide.',
    'The same button is on Robots → Console and each robot’s row at Settings → Digital twins for devs; the key-based command stays there for other harnesses.',
  ],
}

export default note
