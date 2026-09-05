import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2821',
  date: '2026-09-05',
  title: 'Job Summary — a Months view: the monthly P&L',
  kind: 'feature',
  highlights: [
    'A fourth view on Jobs → Job Summary. One bar per month, revenue split into labor, subs, parts, overhead, and true profit, with the true margin on top of each bar and a loss stacked red.',
    'Overhead per month is that month’s whole pool, so the column matches the Overhead tab to the dollar — no allocation argument.',
    'Book by work month (each job spread over the months it was worked, by field hours) or bill month (each job whole to the month its bill went out). Target draws where profit would start on every bar; Compare to puts the change under the tiles.',
  ],
}

export default note
