import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4896',
  date: '2026-10-08',
  title: 'GC mode: Trade partners on real data, for a dev',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A dev opens Trade partners from the switch beside the Project Board on GC projects. Each trade has a card with its companies and the projects still short of quotes.',
    'Add a company on a trade’s card with its contact, its address and how far it drives. A company new to us can quote but waits for approval before any award.',
    'Companies new to us wait at the top with the form they sent. Approve them, approve them up to an amount, or decline them with a note.',
    'Press a company’s address to change where it drives from and how many miles it goes.',
  ],
}

export default note
