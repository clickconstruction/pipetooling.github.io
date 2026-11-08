import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.6690',
  date: '2026-11-08',
  title: 'Job activity’s Customer pill is everything to or from the customer, the papers they got and signed included',
  kind: 'feature',
  highlights: [
    'The Customer pill on a job’s activity now shows everything to or from the customer: their calls, texts and emails as before, and the papers they got or did. The bill sent to them, the contract sent, opened and signed, a release sent to sign, the demand letter and the lien, courtesy and hazmat notices, and their word on when they would pay all count. Those lines stay under Billing too, so Customer is a lens across the feed, and its count says how much reached the customer.',
    'The Pipeline row’s Job activity box reads the same list: a contract the customer opened or signed, a release sent to sign and their word on paying now sit in the box unnumbered, under an Opened, Signed, Said or Sent tag, beside the bill lines it already carried. The notes keep their numbers.',
    'Left out on purpose: a bill made or billed but not yet sent, a contract or release voided, a release signed on our side, the payment itself, and the contract reminders the app emails on its own.',
  ],
}

export default note
