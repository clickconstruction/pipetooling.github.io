import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7508',
  date: '2026-11-16',
  title: 'Lien desk: apply a notice that already went to a job the desk still asks about',
  kind: 'feature',
  highlights: [
    'Already mailed? Record it now asks which paper went when the property has a notice on record. Pick it, tick the month, and the desk stops asking that job for a second notice.',
    'The desk says what matches and what does not. A month the paper does not print, or no copy to the contractor on record, goes through only with a typed reason that stays on the record.',
    'The notice that was waiting is set aside, not mailed, and keeps its approval and signature. Undo on the job’s filings puts everything back.',
    'Only a paper that went to the same owner about the same property, under the same contractor, is offered.',
  ],
}

export default note
