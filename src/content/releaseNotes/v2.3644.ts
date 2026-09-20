import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3644',
  date: '2026-09-20',
  title: 'Contract sweep: each job asks how it gets signed — and picks the likely answer for you',
  kind: 'feature',
  highlights: [
    'Every job in the Contract sweep now shows How this one gets signed, with the answer already picked: a homeowner\'s job leads with Email the PDF to sign by hand — how this office\'s finished contracts have actually been signed — with Email a signing link and Download to print one tap away.',
    'A builder\'s job shows one choice, File their subcontract, because their paper is the agreement. Our own three ways are tucked under Send ours anyway rather than offered as equals.',
    'A job with no email picks Download to print for you, and the email choices say why they are greyed out. Download to print downloads the page and marks it handed over in one press; Preview PDF is there when you only want to look.',
    'The blue button and the sentence beside it follow your pick, so you can always read what is about to happen before it does.',
  ],
}

export default note
