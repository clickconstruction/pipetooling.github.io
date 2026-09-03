import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2718',
  date: '2026-09-03',
  title: 'Tags in Banking: manage them, pick them on rules, see them on every rule',
  kind: 'feature',
  highlights: [
    'Banking → Accounting has a Tags manager beside Rules. A tag is a name, an icon, a color, the bank categories it covers and the accounting labels it stands for — six are set up for you: Fuel & gas, Retail & supply, Office & software, Fees & services, Government, Food & travel.',
    'New rule offers your tags as chips instead of the bank’s spelling. A rule that points at a tag follows the tag: add a category to the tag and the rule catches it on the next sync, no re-saving.',
    'The Rules list shows what each rule matches on as chips and gains a tag bar that filters with one click. "Show as its own cost line" on a tag is what puts Fuel on Review and Job Summary; tick it on any tag you want to see apart.',
  ],
}

export default note
