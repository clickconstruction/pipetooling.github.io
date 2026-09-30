import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4191',
  date: '2026-09-29',
  title: 'Takeoffs and Labor: the base and what the alternate adds',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'On Takeoffs, the Sheet view’s rail now splits Materials on this bid into the base, what each alternate adds, and the total with it — the same three numbers Pricing will read. Every fixture in an alternate wears a small ALT mark.',
    'On Labor, a card above the bottom line shows field hours, labor at the rate and driving for the base, each alternate, and the bid with it. A fixture that sits in both shares one row; its hours follow the counts.',
    'Nothing moves: rows stay where they were, only the totals split. Pricing and the Cover Letter learn the same split in the next releases.',
  ],
}

export default note
