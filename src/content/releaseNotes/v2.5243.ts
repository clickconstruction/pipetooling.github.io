import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5243',
  date: '2026-10-11',
  title: 'The Bridge: the people tables in two groups, and the day grid read three ways (link PR 12)',
  kind: 'feature',
  roles: ['dev'],
  highlights: [
    'Vectors reads in two groups with a subtotal each: Field, who make the contribution, and Office & estimators, who do the billing, collecting and bids. A dev counts as office. Rows sort by contribution, then by hours waiting.',
    'Vectors by the day gains Revenue · Profit · Cost. Profit is the grid as it was, earned at the job’s rate less the wage. Revenue is what the day earned. Cost is what the day cost in wages. The subtitle, the week column, the totals and the Field crew row follow the reading.',
  ],
}

export default note
