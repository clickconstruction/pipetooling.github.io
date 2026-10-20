import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.5679',
  date: '2026-10-20',
  title: 'Cover Letter: address the letter to any GC on the bid',
  kind: 'feature',
  roles: ['estimator', 'dev', 'master_technician', 'assistant', 'controller'],
  highlights: [
    'The Cover Letter gains an Addressed to row when the bid goes to more than one GC. A chip marked same letter heads the same letter with that builder’s name and address — no more retyping the other GCs by hand after pasting.',
    'Only the name and address change: the amount, prices and wording stay the selected letter’s, and Print and the copy buttons say whose copy they produce.',
    '+ GC on the row adds another builder to the bid’s Also sent to list right where the letter is addressed, so Followup and the Bid Board see them too.',
    'A same-letter copy rides the bid’s sent date, and the note under the row offers track separately for a builder who needs their own prices. The bid room stays the bid GC’s — a room carries its own opens and signature, so two builders never share one.',
  ],
}

export default note
