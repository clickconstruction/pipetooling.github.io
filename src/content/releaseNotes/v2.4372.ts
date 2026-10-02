import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4372',
  date: '2026-10-01',
  title: 'Pricing: your history strip adds up past costs the way Pricing does',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The history strip on Pricing still added $10 of estimator time for each fixture row of a past bid. Pricing stopped counting that in September.',
    'Past bids now add up their cost the same way Pricing adds up yours. Each margin goes up a little.',
    'Labor rows marked Task, Sub or per 100 ft now count the way the Labor tab counts them.',
  ],
}

export default note
