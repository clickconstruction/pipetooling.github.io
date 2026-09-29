import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4147',
  date: '2026-09-29',
  title: 'Pipeline Billed rows: the pay history sits under the estimate, and Send back / Collections move under the icons',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'primary'],
  highlights: [
    'The customer’s pay history (“Pays in 2–8d · keeps 3 of 4”, with its little bars) now sits directly under “Billed Sep 29 · expect ~Oct 4” — the evidence next to the estimate it explains, instead of at the bottom of the cell under the lien runway.',
    'On Billed Awaiting Payment and Collections, the Send back and Collections buttons move out of the Progress & payment cell into the action column, stacked under the icons.',
  ],
}

export default note
