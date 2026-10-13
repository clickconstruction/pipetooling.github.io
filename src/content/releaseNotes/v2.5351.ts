import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5351',
  date: '2026-10-12',
  title: 'Messages: where a written promise will also go, behind the scenes',
  kind: 'infra',
  roles: ['dev'],
  highlights: [
    'The rules for where a promise written down in Messages also goes: the ask on the Board, the Pipeline, the bid, or the flow’s reminder.',
    'Each rule says what it skips and what to do by hand. Nothing on screen changes yet.',
  ],
}

export default note
