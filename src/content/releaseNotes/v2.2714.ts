import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2714',
  date: '2026-09-03',
  title: 'Groundwork for bank-category tags in Banking',
  kind: 'feature',
  highlights: [
    'Banking gains a place to keep tags — a name, an icon, a color, the bank categories a tag covers and the accounting labels it stands for. Six families are seeded to start: Fuel & gas, Retail & supply, Office & software, Fees & services, Government, Food & travel.',
    'Accounting label rules can point at a tag, so editing the tag later changes what the rule catches without re-saving it. The manager screen and the tag picker on rules arrive in the next release.',
  ],
}

export default note
