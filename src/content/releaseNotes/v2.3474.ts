import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3474',
  date: '2026-09-15',
  title: 'The demand letter and lien notices carry a clean return address',
  kind: 'fix',
  highlights: [
    'Lien instruments: the top-right of the letterhead is now the company return address line for line — street, city / state / ZIP, phone, email — as typed in Settings, instead of one long string wrapped wherever it fit with a dangling dot.',
    'The sender\'s first name no longer floats above the address; whoever sends the letter still signs it at the bottom.',
    'Same fix on the preview, the emailed letter, the PDF, and the § 53.056 notice / lien paper — slightly larger and darker so the reply address is readable.',
  ],
}

export default note
