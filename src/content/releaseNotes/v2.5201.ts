import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5201',
  date: '2026-10-10',
  title: 'GC mode: a trade partner signs its master agreement and W-9 from its portal',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'A trade partner’s portal now shows its paperwork with us on its home: the master agreement, the W-9, its insurance and its company form.',
    'It opens our master agreement or its W-9 on the same signing page our email opens. Each press makes a new link, so the emailed one stops working.',
    'A company new to us sends the form that tells us about it, and its portal then says we are checking it.',
    'Your papers lists every paper it signed with us. A link that no longer works now says so plainly.',
  ],
}

export default note
