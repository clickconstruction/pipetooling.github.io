import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.4729',
  date: '2026-10-06',
  title: 'Lien desk: enclose a conditional release of lien with the notice',
  kind: 'feature',
  highlights: [
    'A third box above the paper reads Enclose a conditional release, with the claim beside it. It starts off. Ticked, the app’s own conditional release rides behind the owner’s cover letter and behind the GC’s copy of the notice, and the courtesy PDF carries it too.',
    'The release is filled from the notice. The claim is the amount, the GC is the one the check comes from, and it is the Progress form unless the claim is everything still open on the job. The master’s signature prints when he signed it in the app; otherwise he signs it with the notice.',
    'The letter ends with the words: This release is not effective today. It becomes effective only after the claim is received and the funds have cleared. Until then, the notice stands. The enclosure line names it.',
    'The tick makes a draft release on the job, and recording the run issues it, so the Dashboard offers the unconditional the day the money clears. Untick the box and the draft is voided. An amber line says counsel has not read the release paragraph yet.',
  ],
}

export default note
