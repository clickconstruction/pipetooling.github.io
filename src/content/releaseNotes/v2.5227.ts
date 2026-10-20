import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5227',
  date: '2026-10-10',
  title: 'GC mode: Mark it signed asks first when our contract would be $0',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'controller'],
  highlights: [
    'On Get started, Mark it signed now asks before it signs a contract that adds up to $0.',
    'It says no trade carries a price and Our number adds nothing, and offers Sign at $0 anyway or Not now.',
    'A priced contract signs at once, as before.',
  ],
}

export default note
