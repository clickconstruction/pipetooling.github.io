import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6834',
  date: '2026-11-10',
  title: 'A bill paid in kind is not chased, not forecast as cash, and not counted in pay speed',
  kind: 'feature',
  highlights: [
    'A bill on a job an in kind arrangement pays is left off the call list for late payments.',
    'The payment forecast leaves those bills out of every week. Its last line says how much is scheduled in kind.',
    'On the Pipeline’s Billed rows such a bill reads Scheduled in kind, with no expected day and nobody asked for a date.',
    'Pay speed leaves every In kind payment out. A customer who pays in kind no longer reads as paying in 0 days.',
  ],
}

export default note
