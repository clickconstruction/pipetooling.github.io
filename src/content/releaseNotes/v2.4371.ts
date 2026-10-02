import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4371',
  date: '2026-10-01',
  title: 'Pricing: your win and loss history counts Combined materials',
  kind: 'fix',
  roles: ['dev', 'master_technician', 'assistant', 'controller', 'estimator'],
  highlights: [
    'The history strip on Pricing compares your number with past bids you won or lost. It only counted materials from By Stage purchase orders.',
    'Past Combined bids, which is every bid since May, read close to 100% margin. The strip left them out.',
    'Past bids now count their parts list, the same number their Labor tab shows. Plumbing now has enough past bids for the strip to show.',
  ],
}

export default note
