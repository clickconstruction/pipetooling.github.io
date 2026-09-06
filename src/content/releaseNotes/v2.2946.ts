import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2946',
  date: '2026-09-06',
  title: 'The pay week points at its next stop: Hours → Draft Payroll → Tally',
  kind: 'feature',
  highlights: [
    'After you approve hours on People → Hours, a green chip says how many sessions you approved and offers "Draft payroll for <week> →" — one tap opens Draft Payroll on that pay week.',
    'On Draft Payroll, once every person with hours has a report, a line under the buttons says what comes next and offers "Open Tally →".',
    '"Mark payroll" on the Job Parts Tally now works for everyone with payroll access — dev, controller and pay-approved masters — not just dev. Payroll auto-mark rules stay a dev tool.',
    'New guide: "run the pay week from Hours to Tally".',
  ],
}

export default note
