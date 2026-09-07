import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3062',
  date: '2026-09-07',
  title: 'Lien waivers: the pay row picks the right one and sends it',
  kind: 'feature',
  highlights: [
    'Every sheet on Jobs → Subs → Pay has Lien waiver… (in the ⋯ menu and the expanded row). The dialog reads the payment — settled or not, last payment or not — names one of the four Texas waivers, and says why in a sentence.',
    'The sub gets the normal signing email with the project, job number, amount, owner, address and the extent of the release already filled in; they check it, sign on their phone, and the PDF files to People → Contracts.',
    'The two unconditional forms carry their warning in the dialog as well as on the paper: never send one to a sub who has not been paid. Not the one you wanted? The other three are one click away, each with when to use it.',
    'The four statutory forms live in the Contract library → Forms tab in a Lien waivers packet with no assignees — sent one at a time, per payment.',
  ],
}

export default note
