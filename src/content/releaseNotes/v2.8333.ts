import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.8333',
  date: '2026-11-23',
  title: 'Bills sent: who has paid, the day and the way, at a glance',
  kind: 'feature',
  highlights: [
    'Each bill on Bills sent now has a stamp under its amount: Paid with the day, Part paid with what is still out, or Not paid with the days since it went. Small words say how it was paid, like Card · Stripe or Check 4417 · bank deposit.',
    'Every line has its paid day now. Before, a bill sent by text, entered from Housecall Pro or emailed before Oct 5 said Paid since with no day, and a part payment said nothing.',
    'A day’s band says how many of its bills are paid and what is still out. A Not paid tile adds up the open bills on the list, and two new chips, Not paid and Paid, narrow it.',
    'Whether an email arrived now sits at the right end of its line, in plain words, so green means money. Cents are drawn smaller than the dollars. A bill’s record, Print and the spreadsheet carry the payments too.',
  ],
}

export default note
