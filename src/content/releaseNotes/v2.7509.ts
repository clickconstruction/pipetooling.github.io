import type { ReleaseNote } from '../../lib/releaseNotes'

const note: ReleaseNote = {
  version: 'v2.7509',
  date: '2026-11-16',
  title: 'Lien desk: retainage a GC holds that nobody typed is listed',
  kind: 'feature',
  highlights: [
    'The top of By paper, Retainage notices lists open jobs under a GC where the money says retainage is held and nothing is recorded: a bill paid at exactly 90% or 95%, or a note on the job that says retainage.',
    'Each row says why and offers three presses: record the figure the bills show, open the job to type another, or answer that the job has none. A recorded job joins the list under Clock not started and its next monthly notice names the figure.',
    'Edit Job, Our contract on this job offers the same figure on a job with no answer, with one press to use it.',
    'Nothing is written until a person presses. A job with a pay application is left out, since its application is the source.',
  ],
}

export default note
