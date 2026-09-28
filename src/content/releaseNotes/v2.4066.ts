import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4066',
  date: '2026-09-28',
  title: 'Cover Letter: a real Schedule of values, and the payment schedule says what it is',
  kind: 'feature',
  highlights: [
    'A new Schedule of values pill on Cover Letter → Letter content spreads the bid amount across Rough In, Top Out and Trim Set by the stages you set on the Takeoffs sheet — one line per stage with its share, and a Total that always equals the amount. Nothing to type; it goes in the letter and the Approval PDF.',
    'The editor under the pill shows the same lines, says how many costed fixtures are staged, warns when some still need a stage (their money is left out of the shares), and prints the full two-page schedule with an Of contract column at the letter’s amount.',
    'The payment schedule (30/30/30/10 and the like) now prints under the heading “Payment schedule:” instead of “Schedule of Values:”, so the two sections cannot be mistaken for each other. Letters already sent are unchanged.',
    'Alternates and per-GC letters each spread their own amount by the same shares.',
  ],
}

export default note
