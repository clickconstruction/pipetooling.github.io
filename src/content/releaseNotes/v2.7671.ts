import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7671',
  date: '2026-11-17',
  title: 'Supply houses: the bill form’s own rules now have their tests',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. Add invoice, Edit invoice and a bill filled from its PDF open, fill and save as they did.',
    'How a new bill starts, how a stored bill opens, what a fill may write and what Save hands on are each one tested function now.',
    'A fill never writes over a field you typed. That rule has its own test.',
  ],
}

export default note
