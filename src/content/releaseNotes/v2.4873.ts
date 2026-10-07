import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4873',
  date: '2026-10-07',
  title: 'Lien desk: the Affidavits and Retainage panes name the leader too',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'On the Affidavits and Retainage panes, the row that records the leader’s word now opens with his name and today’s date, reads Approve on his word in blue, and offers Preview the record ›, as the notice footer does.',
    'A paper approved on his word reads On Malachi’s word on those panes instead of On the leader’s word.',
  ],
}

export default note
