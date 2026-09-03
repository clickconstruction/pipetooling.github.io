import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2708',
  date: '2026-09-03',
  title: 'Job Summary shows the fuel inside each job’s parts',
  kind: 'feature',
  highlights: [
    'Jobs → Job Summary’s Parts Cost cell now carries a small "fuel $X" line, and the cost breakdown header repeats it, so a job’s pipe and its fill-ups read apart.',
    'Same rule as People → Review: card charges labelled Fuel / Gas in Banking count as fuel, and an unlabelled purchase falls back to the bank’s own category until it is labelled. One classifier, two surfaces.',
    'Parts Cost and profit do not change — the fuel line is a slice of what was already there.',
  ],
}

export default note
