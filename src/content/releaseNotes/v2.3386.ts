import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3386',
  date: '2026-09-14',
  title: 'Contract sweep: every row says whether it is ready, and Send all takes only those',
  kind: 'feature',
  highlights: [
    'Ready no longer means “the email parses”. A row wears what the app knows: Ready · Scope is just the name · No amount · No email · GC job · file theirs · + J798 (same customer). The header counts the pile — “104 without a contract · $1.3M of work · 17 need a look” — and To send · Needs a look · All splits it.',
    'The row’s one button follows its state: Send, Fix email, File theirs (the builder’s subcontract, straight onto the filing sheet), or Add scope.',
    'Send all moves under ⋯, takes only Ready rows, and asks once with the real number: “Email 81 customers (87 agreements)?”. A row with a thin scope or no amount never goes out unseen.',
    'The sweep now uses the job’s accepted estimate for the scope and amount, the same way the Contract modal does.',
  ],
}

export default note
