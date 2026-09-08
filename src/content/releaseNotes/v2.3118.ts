import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3118',
  date: '2026-09-08',
  title: 'Every signing page says what an electronic signature means, and keeps the words',
  kind: 'feature',
  highlights: [
    'Estimates, job agreements, contracts and forms, sub work orders and the Bid Room now carry one quiet line under the signature: a typed or drawn signature has the same legal effect as ink, and paper is available on request. "How electronic signing works" opens the detail, citing the federal ESIGN Act and the Texas UETA, with a link to the full disclosure.',
    'A separate "I agree to sign electronically" checkbox is its own act, ahead of the usual "I have read and agree" box. Spanish on the sub portal and the forms.',
    'The exact words each signer saw are stored with the signature (version and language), and the signed record, the PDFs and the audit lines cite both statutes.',
    'Signing emails mention the paper option; the public Terms page gains the full "Electronic signatures and records" disclosure with the office contact.',
  ],
}

export default note
