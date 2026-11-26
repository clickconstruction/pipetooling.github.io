import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8645',
  date: '2026-11-26',
  title: 'Settings: a kept map address that cannot be cleared says the reason that holds',
  kind: 'fix',
  highlights: [
    'Under Kept map addresses, a long address with no number in it read as too short to tell apart, and its Clear was greyed out. The address was not short.',
    'Now the line says what is so: the address has no street number, or no street name, or is too short.',
    'The rule is the same. Such an address still stays.',
  ],
}

export default note
