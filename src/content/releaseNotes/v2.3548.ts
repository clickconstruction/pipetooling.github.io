import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3548',
  date: '2026-09-16',
  title: 'Pipeline: each row kind of the billing tables is its own piece',
  kind: 'infra',
  highlights: [
    'Nothing changes on screen. The Ready to Bill, Billed and Collections tables draw two kinds of row — a job with its bill line, and a standalone bill — and each kind now lives in its own file, so a change to one cannot disturb the other.',
  ],
}

export default note
