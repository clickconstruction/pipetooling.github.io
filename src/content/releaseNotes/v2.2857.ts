import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2857',
  date: '2026-09-05',
  title: 'File a sub\'s COI or W-9 right on their row',
  kind: 'feature',
  highlights: [
    'People → Subs → ▶ Documents and Person Desk → Paperwork both have an "Add document" button now: pick COI, W-9, license, or a paper-signed agreement, give it an expiration (a COI needs one) and an optional link to the file, and Save. The compliance badge flips as soon as it lands — no more sending a contract from Contracts just to re-type it here.',
    'A document named like a COI, W-9, or license but still typed as the Agreement (which is what anything minted on Contracts becomes) shows "Looks like a W-9 — set type" on the Subs row; one click fixes it.',
    'Person Desk paperwork chips name the compliance type in their tooltip (COI · W-9 · License) so filed paperwork reads as what it is.',
    'Who can add: dev, master, assistant, controller — the same roles the database already let update these rows. Training-mode viewers see no button.',
  ],
}

export default note
