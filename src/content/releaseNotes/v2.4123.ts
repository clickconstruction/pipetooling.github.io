import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4123',
  date: '2026-09-29',
  title: 'Submittals: Walk me through it in plain words',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'estimator', 'controller'],
  highlights: [
    'Every stop of the walkthrough is rewritten in short sentences: one idea each, what this is, what you do, what happens after. Trade words get a plain word beside them the first time, like a cut sheet, the maker’s page for the product.',
    'Thirteen stops instead of fifteen. The revision chips and the counts line no longer get a stop of their own; Step 2 and Step 3 say what they are.',
    'Step 1 rings the three source cards, not the line above them.',
  ],
}

export default note
