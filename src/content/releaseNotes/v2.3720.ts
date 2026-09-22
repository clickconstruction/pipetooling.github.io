import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3720',
  date: '2026-09-22',
  title: 'Lien desk: the run mails one envelope per name and address',
  kind: 'feature',
  highlights: [
    'Send the run listed an envelope per copy — a nine-job run for one GC meant nine envelopes to the same GC address, and two jobs at one property meant two to the same owner. Now notices to one name at one address share an envelope: the owner’s, and one to the original contractor with every notice inside. Each envelope has one delivery method and one tracking number, which covers everything in it.',
    'The packet prints in envelope order — the cover sheet, then what goes in each envelope, the owner’s copy behind its cover page and the GC’s copy alone — so the stack comes off the printer ready to stuff.',
    'Put a GC on notice: the envelope count above the steps is the number the run will actually mail.',
  ],
}

export default note
