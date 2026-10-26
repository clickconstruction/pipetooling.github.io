import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5865',
  date: '2026-10-25',
  title: 'The Bridge: dead code out of the dial and the calls',
  kind: 'fix',
  roles: ['dev'],
  highlights: [
    'The dial kernel no longer takes a field-hours parameter it never read; the page computes each stage\'s unit itself.',
    'The calls client reads and writes bridge_calls through the generated types instead of casting past them.',
  ],
}

export default note
