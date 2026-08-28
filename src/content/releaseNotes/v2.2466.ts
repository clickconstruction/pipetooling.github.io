import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.2466',
  date: '2026-08-28',
  title: 'Bid saves everywhere now tell you when they did not stick',
  kind: 'fix',
  highlights: [
    'A bid save can quietly not apply — for example when the bid was deleted by someone else mid-edit, or your account is not allowed to change it. The Edit Bid window already caught this; every other place that writes to a bid now catches it too.',
    'Covered doors include the call queue and call sessions, the Waiting-to-hear and Why-we-lost lenses, quick lost capture, cover letter and mark-sent, the Bid Board archive/un-archive, pricing and book version pickers, bid notes, the submission link, and Documents → bid links.',
    'When a save does not stick, you now get a clear error instead of a screen that pretends it saved.',
  ],
}

export default note
