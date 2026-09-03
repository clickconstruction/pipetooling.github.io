import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2700',
  date: '2026-09-03',
  title: 'Fuel is fuel: bank-category rules in Banking, a fuel line on Review',
  kind: 'feature',
  highlights: [
    'Accounting label rules in Banking can now match on the bank’s own category of a card purchase — so one rule, "FuelAndGas → Fuel / Gas", labels every fill-up automatically, on sync and with Apply rules for the backlog.',
    'People → Review splits "parts" into parts & job purchases, fuel, and subs & team labor in the math drawer, and the verdict bar shows fuel as its own segment. The Fuel / Gas label wins; an unlabelled purchase falls back to the bank category until it is labelled.',
    'Totals do not move — the same dollars are just named. What fuel should mean for job profit is a separate decision.',
  ],
}

export default note
