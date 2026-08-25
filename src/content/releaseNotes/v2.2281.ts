import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2281',
  date: '2026-08-25',
  title: 'Goals bar: every stage square the same size',
  kind: 'fix',
  highlights: [
    'When the Goals stage bar wraps on a phone, every square is now the same size on every row — a short last row simply ends early instead of stretching its few stages into giants.',
    'Small roadmaps that fit one row still fill the card edge-to-edge like before.',
  ],
}

export default note
