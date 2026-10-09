import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5058',
  date: '2026-10-09',
  title: 'Division 22 codes: see every rule and section',
  kind: 'feature',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The Division 22 codes window has three tabs: Names, Rules and Sections. Names is the list you pin codes from, as before.',
    'Rules shows every rule under its section and how many names it decides. A rule that never decides names the rule that wins first.',
    'Sections shows each section with its rules, the names filed under it and the bids behind them.',
  ],
}

export default note
