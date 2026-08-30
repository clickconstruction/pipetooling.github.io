import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2509',
  date: '2026-08-30',
  title: 'Dashed pipes found — the east wing is traced and every check is green',
  kind: 'feature',
  highlights: [
    'A dash-aware density scan integrates ink along the run direction, finding dashed and dash-dot pipe styles that single-row probes miss entirely — it located six east-wing water lines and seven fixture spurs in one pass.',
    'Registration bars are now per-run, matched to each line style\'s dash duty — honest gates for dashed pipe instead of impossible ones.',
    'The twin\'s LIVSTE takeoff is complete: 19 registered runs, and for the first time the connectivity check is fully clean — every fixture has its supply within reach.',
  ],
}

export default note
