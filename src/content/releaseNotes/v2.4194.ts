import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4194',
  date: '2026-09-29',
  title: 'Pricing: the base and what the alternate adds, on the Workbench',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'When a bid carries an alternate, the Workbench’s scoreboard grows a second line: Base, what each alternate adds, the total with it, and the alternate’s own margin. Every row in an alternate wears the ALT mark.',
    'Prices, the solver and the brush work exactly as before — price a row in the alternate and the + number moves with the whole.',
    'A fixture that sits in both the base and an alternate is two rows on purpose, and copying prices across versions now pairs each with its own counterpart instead of skipping the name.',
  ],
}

export default note
