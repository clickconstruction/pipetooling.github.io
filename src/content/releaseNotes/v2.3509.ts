import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3509',
  date: '2026-09-16',
  title: 'What customers see now shows the paper: the bill by email, the hazmat notice, the demand letter, the owner notice and the lien release',
  kind: 'feature',
  highlights: [
    'Five more steps render on Settings → What customers see, built from the sample by the same code that builds the real documents: the bill sent by email, the biohazard remediation fee notice, the final demand letter, the § 53.056 notice to a property owner, and the lien release.',
    'Each opens as a preview in the frame, with its email subject where it travels as an email, and an Open the PDF button that builds the document the customer would actually receive.',
    'The estimate terms page now renders too. The count at the top says how many steps open as a PDF.',
  ],
}

export default note
