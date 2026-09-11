import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3325',
  date: '2026-09-11',
  title: 'The law firm runs its own inbox',
  kind: 'feature',
  highlights: [
    'On the portal\'s new Notifications page the firm adds its people and gives each one rule: right away or a weekly digest (day and Central time), every matter or only the ones they handle. A new address gets one confirmation email and nothing else until they click it; every email carries a one-click stop.',
    'They hear about a new account referred to them, the office answering a question, and an account pulled back. Digest people get one email on their day with every open matter and everything since their last digest.',
    'The office sees the same rules on the desk (✉ Firm\'s emails) with two overrides — remove a person, pause all emails to the firm — and the Mark attorney ready sheet says who will hear: email now, in their digest, not confirmed, not emailed.',
    'The firm\'s emails are listed in the Outbound email catalog on Settings → Email templates.',
  ],
}

export default note
