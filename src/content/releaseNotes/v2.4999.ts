import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4999',
  date: '2026-10-08',
  title: 'GC projects: email the certified bill and change orders to the customer',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Record the certificate has a new tick, Email the customer the bill now. It starts off.',
    'With it on, the customer reads what the architect certified and when we expect it, and replies with the day they will pay. Their portal link comes too when they have one.',
    'Send for signature on a change order has its own tick, Email it to the customer now. They reply to sign it.',
    'Each window says who an email went to and when.',
  ],
}

export default note
