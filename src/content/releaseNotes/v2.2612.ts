import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2612',
  date: '2026-09-01',
  title: 'Copy fixtures for text gets a prepare screen',
  kind: 'feature',
  highlights: [
    'Copying no longer happens blind: a prepare screen opens first with vendor scopes — Whole job, Pipe & fittings, Fixtures & equipment — plus checkboxes per section and per row.',
    'Names that still need a Division 22 code sit at the top with inline Pin controls — fix them right there, for every bid at once.',
    'A live preview shows the exact text you’ll paste, updating as you toggle. What you see is what hits the clipboard.',
    'Scope and exclusions apply to that copy only — the bid is never changed.',
  ],
}

export default note
