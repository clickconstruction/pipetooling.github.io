import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5084',
  date: '2026-10-09',
  title: 'GC mode: the presses behind the trades’ draws and pay applications',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'GC mode can keep a trade’s pay applications on a job we build: asked, approved, approved for less, sent back and sent again, and paid, with each lien waiver.',
    'The office can record a pay application or a waiver that came by email. A back-charge can come off an approved draw, and a signed change order can go to its trade.',
    'A change order’s credit now comes off a trade’s pay application once, not on every one, and a back-charge is never paid back with the retainage. Nothing on screen uses this yet; the Draws window comes next.',
  ],
}

export default note
