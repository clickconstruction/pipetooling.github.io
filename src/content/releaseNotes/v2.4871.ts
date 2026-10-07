import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4871',
  date: '2026-10-07',
  title: 'Contracts: the signed copy names its signers the same way as everywhere else',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'When an agreement is signed online, the customer’s signed copy and the office’s notice now get the signers’ names from the same rule as the rest of the app. Two signers read Sam Owner and Alex Owner, and one signer reads their own name.',
    'Nothing reads differently today. This keeps the emails in step if that rule ever changes.',
  ],
}

export default note
