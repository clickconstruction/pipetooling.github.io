import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5404',
  date: '2026-10-12',
  title: 'Messages: the Lien desk’s letters in a customer’s thread, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'A notice or a demand letter the Lien desk sent will show in the customer’s thread as a grey line from the office.',
    'Under it only the office can reply, and the customer’s answer goes to the office, never to a tech.',
    'A Lien release on that job opens the reply box again. Nothing on screen changes yet.',
  ],
}

export default note
