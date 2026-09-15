import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.3470',
  date: '2026-09-15',
  title: 'Put a GC on notice: every owner on every job, in one approved run',
  kind: 'feature',
  highlights: [
    'When a GC stops paying, one modal sends the § 53.056 notice to the owner of every job with unpaid work under that GC — billed or still working — naming every unnoticed month, in one run. Three doors: the Pipeline tools ⋯ with a GC filter on, the Lien desk header (a picker of GCs with notices due), and Bids → Customer review’s Put on notice… beside set terms.',
    'The owners come first: the app looks every property without an owner up on the appraisal roll as the modal opens; Use all found saves them in one press, a miss gets the door or a typed owner, a public owner (a city, a school district) is left out of the run with the bond-claim note.',
    'What each notice claims is shown, not assumed: a closed window is named as information, an unbilled job claims its contract balance and says so with Bill the finished work one click away, and the affidavit date sits beside each row.',
    'The decision once: a reason kept on every notice’s record, the GC’s standing rule (starts the moment the run is recorded — never a GC’s first notice), payment terms → Winding down, and a Legal desk matter with every job. Approve all N sends the run; the office can send the set to the leader or record his spoken word.',
  ],
}

export default note
