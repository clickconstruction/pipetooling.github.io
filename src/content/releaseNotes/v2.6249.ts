import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6249',
  date: '2026-10-31',
  title: 'The jurat no longer prints a (Personalized Seal) caption (punch list #220)',
  kind: 'fix',
  highlights: [
    'A sworn statement’s jurat keeps blank room above the notary’s signature and drops the (Personalized Seal) words. A notary knows where the seal goes.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
