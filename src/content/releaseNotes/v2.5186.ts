import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5186',
  date: '2026-10-10',
  title: 'GC projects: the app can tell a customer a bill is due in 3 days, once the owner turns it on',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'Three days before a certified bill is due, the customer gets an email from Click Construction. It says when the bill is due and what is still open.',
    'Each bill gets it once, and never a bill on card. Replies go to the project manager.',
    'The owner turns it on in Settings, under Jobs & billing, after reading a test copy. Preview shows who would hear today.',
    'A certified bill says when the customer was told.',
  ],
}

export default note
