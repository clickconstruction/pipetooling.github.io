import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8490',
  date: '2026-11-24',
  title: 'GC projects: take back an ask the company already heard about',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'Take the ask back… now shows on every ask still open. An ask the company opened, was emailed about or was called on closes as we took it back.',
    'The close is ours. It does not count as a pass on the company’s record, and the chip reads we took it back.',
    'The company’s portal says we took the invitation back. No email goes to them, so call them if they should know today.',
    'An ask the company never heard about is still deleted, as before. The window says which of the two will happen before you press.',
  ],
}

export default note
