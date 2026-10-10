import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5191',
  date: '2026-10-10',
  title: 'GC mode: what lets a trade partner send its own papers from its portal, behind the scenes',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A trade partner will be able to send its insurance certificate from its portal. It counts as in once it is filed.',
    'A company new to us will be able to send the form that tells us about it, until we decide.',
    'It will open its master agreement or its W-9 to sign on the same signing page the email opens.',
    'Nothing in the portal calls these yet. Its paperwork block comes next.',
  ],
}

export default note
