import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5418',
  date: '2026-10-12',
  title: 'Messages: two boxes and two numbers behind one inbox, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Customers, leads, subs and candidates belong to the team box. Trades, architects and supply houses belong to bids@.',
    'A reply goes from the box the person wrote to. A conversation we start goes from the box of their kind.',
    'A STOP to one of our numbers silences only that number for the person. A START reopens only the one it came to.',
    'Nothing on screen changes yet.',
  ],
}

export default note
