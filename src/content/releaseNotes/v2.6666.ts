import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6666',
  date: '2026-11-07',
  title: 'The superintendents’ scoreboard: hours saved against the award, paid as a share of the labor kept at the office’s sign-off',
  kind: 'feature',
  highlights: [
    'People → Review → Scoreboard now reads the superintendents against their baselines for a month: the jobs the office signed off, hours used of the hours earned, days against the plan, labor kept and the bonus, one row each, with the jobs that could not score named with their reason. A dev or a pay-approved master sees it; labor dollars show only with payroll access.',
    'The rule, on the owner’s three calls: the office’s own sign-off on the percent is what counts, the bonus is a share of the labor kept (the award’s labor dollars at that percent minus the team at the burden factor and the subs on their sheet hours), and a stage a sub performs counts on its sheet hours. A project over its baseline pays nothing and owes nothing back; one awarded on the book’s hours waits for a real baseline.',
    'A superintendent’s project card in Job Mode gains one line: Scored this month: 42 h under the baseline · 1 day ahead of the plan · bonus $213. His own row, no wage, no one else’s figures.',
    'Settings → People → Superintendent bonus holds the one number the owner sets, the share of the labor kept. The month and the sign-off are the owner’s call and are not settings.',
  ],
}

export default note
