import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5128',
  date: '2026-10-09',
  title: 'GC mode: a trade partner’s papers read from its own file',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A trade partner’s master agreement, W-9 and insurance certificate now read from the papers on file for the company itself.',
    'The schedule’s not-ready notes and the trade’s portal read the same papers, so the portal’s Sign waits until the master agreement is signed.',
    'Each company also counts the trades it won.',
    'Nothing on screen changes yet.',
  ],
}

export default note
