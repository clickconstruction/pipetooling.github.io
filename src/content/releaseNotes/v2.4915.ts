import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4915',
  date: '2026-10-08',
  title: 'GC mode: the rules for changing our contract with the customer',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'Change orders to a GC customer get their rules: each is numbered on the job, moves from a draft to sent to signed or declined, and keeps what it said once it went.',
    'A time extension asks for the days the customer’s schedule moves cost, with no price. Only a dev can use them while they are built, and nothing on screen calls them yet.',
  ],
}

export default note
