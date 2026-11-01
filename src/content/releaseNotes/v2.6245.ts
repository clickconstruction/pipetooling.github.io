import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6245',
  date: '2026-10-31',
  title: 'A declaration’s county picks name the signer, not a notary (punch list #220)',
  kind: 'fix',
  highlights: [
    'In Swear a statement…, picking No notary now changes the Signed in picks: each county says it is where they sign, and the blank reads Leave it blank for the signer.',
    'When the property’s county is the office’s county too, the one pick says so, instead of reading as the office’s alone.',
  ],
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
}

export default note
