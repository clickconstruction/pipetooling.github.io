import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3224',
  date: '2026-09-10',
  title: 'Robots → Console, and Claude Desktop set up by one command',
  kind: 'feature',
  highlights: [
    'A new dev-only Console lens under Bids → 🤖 Robots is the operator’s desk: start a robot from Claude Desktop, hand the hourly Claude Code routine to someone, see which bids want a robot, answer what blocked one, and watch the runs come in. Estimators’ lenses are unchanged.',
    'Setting up Claude Desktop is now one Terminal command instead of editing a JSON file by hand. It asks for the robot key privately, finds Node, and writes the connector config — including on a fresh install that has no config block yet. The same button sits beside a freshly issued key on Settings → Digital twins.',
    'Settings → Digital twins keeps what it is for — minting twins, keys, safety rungs, endpoints, and who the robots calibrate to — and its step 4 is now a door to the Console.',
    'The Desktop kickoff’s setup steps are rewritten around the command, tell the robot what to do when the connector never loaded, and ask for an incognito chat so nothing from an earlier batch is remembered into the next one.',
  ],
}

export default note
