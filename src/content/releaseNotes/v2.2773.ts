import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2773',
  date: '2026-09-04',
  title: 'Contracts: the "sign this" email looks like the sub portal',
  kind: 'feature',
  highlights: [
    'The email a person gets when you send them a contract to sign is on the same paper as the sub portal: the CLICK. letterhead, the document name, who sent it, three signing steps, and a "Read and sign" button.',
    'It comes from "Click Plumbing and Electrical" with your address as the reply-to, and the subject reads "Please sign: <document> · Click Plumbing and Electrical" instead of naming the signer back to themselves.',
    'The link\'s expiry date is on the email, and when the person has a live portal page the email says the signed copy will be waiting there.',
    'The send dialog previews the real email, with your opening message in your own words.',
  ],
}

export default note
