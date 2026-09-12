import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3360',
  date: '2026-09-12',
  title: 'People → Review counts earned revenue the way the Bridge does',
  kind: 'feature',
  highlights: [
    'A job with no % complete now counts as half done on Review (it used to count as finished), and a job that is ready to bill, billed, or paid counts as 100% whatever its % says — the same rule the Bridge proved against the bank.',
    'Your share of a job\'s value is now your clock hours on it divided by the job\'s lifetime clock hours. It used to be wage-weighted, so a higher wage was credited with more revenue for the same hours.',
    'Sub labor sheets are a job cost, not a share of revenue — they have no clock hours. The Gross drilldown\'s share columns now read "Your hours ÷ Job hours".',
    'Result: a person\'s earned dollars on Review and on the Bridge\'s Vectors panel are the same number for the same hours.',
  ],
}

export default note
