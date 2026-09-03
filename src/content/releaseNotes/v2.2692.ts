import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2692',
  date: '2026-09-03',
  title: 'Job Summary — true profit, finished jobs first, sortable',
  kind: 'feature',
  highlights: [
    'Jobs → Job Summary now opens on Finished (100%) jobs worked this year, with Show / Worked in chips to change that, and every column header sorts. A totals row and a summary strip sit above the table.',
    'Each job is charged its share of overhead — by default "day-share": every day\'s office pool (office labor, bid labor, office parts) split across the jobs worked that day by field hours. The last columns are Overhead, True profit, and True %; expand a row for "Overhead — the math" day by day. The A / B / C lenses from People → Overhead are one click away for comparison.',
    'In-progress jobs show earned revenue (contract × % complete) so costs-to-date sit next to value-to-date. Parts now leave out internal transfers and count a card charge once when it\'s linked to a supply-house invoice.',
  ],
}

export default note
