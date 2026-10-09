import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5119',
  date: '2026-10-09',
  title: 'Contracts: copying the link of an agreement emailed as a PDF no longer counts as a new send',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'Copy link, Text the link and Sign here, now hand out the link the agreement already has. They no longer send it again.',
    'So an agreement emailed as a PDF to sign stays that way, and File the signed copy still turns it into the signed record when the paper comes back.',
    'When the agreement’s link has expired, these buttons renew it as before.',
  ],
}

export default note
