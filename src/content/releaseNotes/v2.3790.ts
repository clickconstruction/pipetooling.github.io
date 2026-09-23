import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3790',
  date: '2026-09-24',
  title: 'Ask the law firm — a question, or a sign-off on one job — and counsel answers on their portal',
  kind: 'feature',
  highlights: [
    'The Legal desk’s Fees & steps tab gains Ask the firm…: a question for counsel, or a sign-off on one job (the owner wants to pay Click direct while the GC is silent — counsel’s memo says take their okay per job before accepting the check). The ask shows on the desk as “waiting on the firm” with Withdraw until they answer.',
    'On the firm’s portal the asks sit at the top of Fees & steps under From the office: a question gets an answer box; a sign-off gets Signed off / Not yet with an optional note. Their answer lands on the office’s Needs You card (“1 answer from counsel · 1 sign-off granted”) and clears from the desk when acknowledged.',
    'A sent § 53.056 notice on the Lien desk carries the door too — Ask counsel to sign off… on the footer, prefilled with the owner’s situation, only when the job’s account is with the firm — and the footer then reads asked counsel · waiting, counsel signed off Oct 3 · take the owner’s payment, or counsel said not yet.',
    'Nothing new is stored: an ask is a question entry from the office and the answer an entry from the firm, both kinds the matter’s stream already allowed. A sign-off moves no money and changes no stage; the office still records the payment on the job.',
  ],
}

export default note
