import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3436',
  date: '2026-09-14',
  title: 'Demand letter: email it with the PDF',
  kind: 'feature',
  highlights: [
    'A new “Email with the PDF…” button on the demand letter sends the letter and every exhibit as one attachment to the payer’s email, prefilled from the bill.',
    'The send is recorded on the job as an email with the message id as its tracking, so the deadline watch arms the same way it does for certified mail.',
    'Certified mail stays the default — the sheet says so. Email is the second channel, never the only one for a letter that has to be proven.',
  ],
}

export default note
